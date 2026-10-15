import "server-only";

import { AppError } from "@/lib/api-errors";
import type { DbClient } from "@/lib/db-utils";
import type { PrecioDetalle } from "@/interfaces/productos";

export type PrecioCalculable = Pick<PrecioDetalle,
  "valor" | "porcentaje_ganancia" | "modo_calculo" | "importe_origen" | "moneda_origen" |
  "referencia_cotizacion" | "lado_cotizacion" | "tipo_recargo_cotizacion" | "recargo_cotizacion"
>;

const round = (value: number) => Math.round(value * 100) / 100;

function asPositiveNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

/**
 * Calcula el ARS vigente sin alterar el importe que el usuario ingreso en su moneda de origen.
 * La cotizacion se toma siempre del ultimo valor VIGENTE, por lo que un registro previo no puede
 * recalcularse con una cotizacion vacia o en error.
 */
export async function calcularPrecioArsDesdeOrigen(client: DbClient, precio: PrecioCalculable) {
  const modo = precio.modo_calculo ?? "MARGEN_COSTO";
  const importe = asPositiveNumber(precio.importe_origen) ?? Math.max(0, Number(precio.valor) || 0);

  if (modo === "MARGEN_COSTO") {
    return { valor: round(Math.max(0, Number(precio.valor) || 0)), importeOrigen: null, cotizacionUsada: null };
  }

  if (modo === "FIJO_ARS") {
    return { valor: round(importe), importeOrigen: importe, cotizacionUsada: 1 };
  }

  const moneda = precio.moneda_origen;
  const referencia = precio.referencia_cotizacion;
  const lado = precio.lado_cotizacion;
  if (!moneda || moneda === "ARS" || !referencia || !lado || importe <= 0) {
    throw new AppError("Indica importe, moneda y cotizacion para el precio fijo en moneda.", 400);
  }

  const quote = await client.query<{ valor_compra: number | null; valor_venta: number | null }>(
    `SELECT valor_compra, valor_venta
     FROM public.moneda_cotizacion
     WHERE moneda = $1 AND referencia = $2 AND estado = 'VIGENTE'
     ORDER BY actualizado_at DESC, id DESC
     LIMIT 1`,
    [moneda, referencia]
  );
  const value = lado === "COMPRA" ? quote.rows[0]?.valor_compra : quote.rows[0]?.valor_venta;
  const cotizacion = asPositiveNumber(value);
  if (!cotizacion) throw new AppError(`No hay una cotizacion vigente de ${moneda} ${referencia} (${lado}).`, 409);

  const recargo = Math.max(0, Number(precio.recargo_cotizacion) || 0);
  const adjustedQuote = precio.tipo_recargo_cotizacion === "MONTO_FIJO"
    ? cotizacion + recargo
    : cotizacion * (1 + recargo / 100);
  return { valor: round(importe * adjustedQuote), importeOrigen: importe, cotizacionUsada: round(adjustedQuote) };
}

export async function recalcularPreciosMargenDesdeCosto(client: DbClient, productIds: number[]) {
  const ids = [...new Set(productIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (ids.length === 0) return 0;

  const result = await client.query(
    `WITH tipo_costo AS (
       SELECT id FROM public.tipo_precio WHERE upper(trim(descripcion)) = 'PRECIO COSTO' ORDER BY id LIMIT 1
     )
     UPDATE public.producto_precio venta
     SET precio = ROUND(costo.precio * (1 + COALESCE(venta.porcentaje_ganancia, 0) / 100), 2)
     FROM public.producto_precio costo
     CROSS JOIN tipo_costo
     WHERE venta.id_producto = costo.id_producto
       AND venta.id_producto = ANY($1::int[])
       AND costo.id_tipo_precio = tipo_costo.id
       AND venta.id_tipo_precio <> tipo_costo.id
       AND COALESCE(venta.modo_calculo, 'MARGEN_COSTO') = 'MARGEN_COSTO'
       AND venta.precio IS DISTINCT FROM ROUND(costo.precio * (1 + COALESCE(venta.porcentaje_ganancia, 0) / 100), 2)`,
    [ids]
  );
  return result.rowCount ?? 0;
}

async function recalcularPreciosMargenKits(client: DbClient, kitIds: number[]) {
  const ids = [...new Set(kitIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (ids.length === 0) return 0;
  const result = await client.query(
    `WITH tipo_costo AS (
       SELECT id FROM public.tipo_precio WHERE upper(trim(descripcion)) = 'PRECIO COSTO' ORDER BY id LIMIT 1
     )
     UPDATE public.kit_precio venta
     SET precio = ROUND(costo.precio * (1 + COALESCE(venta.porcentaje_ganancia, 0) / 100), 2)
     FROM public.kit_precio costo
     CROSS JOIN tipo_costo
     WHERE venta.id_kit = costo.id_kit
       AND venta.id_kit = ANY($1::int[])
       AND costo.id_tipo_precio = tipo_costo.id
       AND venta.id_tipo_precio <> tipo_costo.id
       AND COALESCE(venta.modo_calculo, 'MARGEN_COSTO') = 'MARGEN_COSTO'
       AND venta.precio IS DISTINCT FROM ROUND(costo.precio * (1 + COALESCE(venta.porcentaje_ganancia, 0) / 100), 2)`,
    [ids]
  );
  return result.rowCount ?? 0;
}

/** Revaloriza los precios fijos en moneda. Los importes fuente nunca se modifican. */
export async function recalcularPreciosFijosEnMoneda(client: DbClient) {
  const rows = await client.query<{
    id: number;
    id_producto: number;
    id_tipo_precio: number;
    precio: number;
    importe_origen: number | null;
    moneda_origen: PrecioDetalle["moneda_origen"];
    referencia_cotizacion: PrecioDetalle["referencia_cotizacion"];
    lado_cotizacion: PrecioDetalle["lado_cotizacion"];
    tipo_recargo_cotizacion: PrecioDetalle["tipo_recargo_cotizacion"];
    recargo_cotizacion: number | null;
  }>(
    `SELECT id, id_producto, id_tipo_precio, precio, importe_origen, moneda_origen, referencia_cotizacion,
       lado_cotizacion, tipo_recargo_cotizacion, recargo_cotizacion
     FROM public.producto_precio
     WHERE modo_calculo = 'FIJO_MONEDA'`
  );

  const changedProducts = new Set<number>();
  let actualizados = 0;
  for (const row of rows.rows) {
    let calculated: Awaited<ReturnType<typeof calcularPrecioArsDesdeOrigen>>;
    try {
      calculated = await calcularPrecioArsDesdeOrigen(client, {
        valor: Number(row.precio), porcentaje_ganancia: 0, modo_calculo: "FIJO_MONEDA",
        importe_origen: row.importe_origen === null ? null : Number(row.importe_origen),
        moneda_origen: row.moneda_origen, referencia_cotizacion: row.referencia_cotizacion,
        lado_cotizacion: row.lado_cotizacion, tipo_recargo_cotizacion: row.tipo_recargo_cotizacion,
        recargo_cotizacion: row.recargo_cotizacion === null ? null : Number(row.recargo_cotizacion),
      });
    } catch {
      continue;
    }
    if (Math.abs(Number(row.precio) - calculated.valor) < 0.005) continue;
    await client.query(
      `UPDATE public.producto_precio
       SET precio = $2, cotizacion_usada = $3, actualizado_origen_at = NOW()
       WHERE id = $1`,
      [row.id, calculated.valor, calculated.cotizacionUsada]
    );
    await client.query(
      `INSERT INTO public.precio_moneda_historial
       (tipo_entidad, id_entidad, id_tipo_precio, motivo, modo_calculo, importe_origen, moneda_origen, cotizacion_usada, precio_ars)
       VALUES ('ITEM', $1, $2, 'ACTUALIZACION_COTIZACION', 'FIJO_MONEDA', $3, $4, $5, $6)`,
      [row.id_producto, row.id_tipo_precio, row.importe_origen, row.moneda_origen, calculated.cotizacionUsada, calculated.valor]
    );
    changedProducts.add(Number(row.id_producto));
    actualizados += 1;
  }
  await recalcularPreciosMargenDesdeCosto(client, [...changedProducts]);

  const kits = await client.query<{
    id: number;
    id_kit: number;
    id_tipo_precio: number;
    precio: number;
    importe_origen: number | null;
    moneda_origen: PrecioDetalle["moneda_origen"];
    referencia_cotizacion: PrecioDetalle["referencia_cotizacion"];
    lado_cotizacion: PrecioDetalle["lado_cotizacion"];
    tipo_recargo_cotizacion: PrecioDetalle["tipo_recargo_cotizacion"];
    recargo_cotizacion: number | null;
  }>(
    `SELECT id, id_kit, id_tipo_precio, precio, importe_origen, moneda_origen, referencia_cotizacion,
       lado_cotizacion, tipo_recargo_cotizacion, recargo_cotizacion
     FROM public.kit_precio
     WHERE modo_calculo = 'FIJO_MONEDA'`
  );
  const changedKits = new Set<number>();
  let kitsActualizados = 0;
  for (const row of kits.rows) {
    let calculated: Awaited<ReturnType<typeof calcularPrecioArsDesdeOrigen>>;
    try {
      calculated = await calcularPrecioArsDesdeOrigen(client, {
        valor: Number(row.precio), porcentaje_ganancia: 0, modo_calculo: "FIJO_MONEDA",
        importe_origen: row.importe_origen === null ? null : Number(row.importe_origen),
        moneda_origen: row.moneda_origen, referencia_cotizacion: row.referencia_cotizacion,
        lado_cotizacion: row.lado_cotizacion, tipo_recargo_cotizacion: row.tipo_recargo_cotizacion,
        recargo_cotizacion: row.recargo_cotizacion === null ? null : Number(row.recargo_cotizacion),
      });
    } catch {
      continue;
    }
    if (Math.abs(Number(row.precio) - calculated.valor) < 0.005) continue;
    await client.query(
      `UPDATE public.kit_precio SET precio = $2, cotizacion_usada = $3, actualizado_origen_at = NOW() WHERE id = $1`,
      [row.id, calculated.valor, calculated.cotizacionUsada]
    );
    await client.query(
      `INSERT INTO public.precio_moneda_historial
       (tipo_entidad, id_entidad, id_tipo_precio, motivo, modo_calculo, importe_origen, moneda_origen, cotizacion_usada, precio_ars)
       VALUES ('KIT', $1, $2, 'ACTUALIZACION_COTIZACION', 'FIJO_MONEDA', $3, $4, $5, $6)`,
      [row.id_kit, row.id_tipo_precio, row.importe_origen, row.moneda_origen, calculated.cotizacionUsada, calculated.valor]
    );
    changedKits.add(Number(row.id_kit));
    kitsActualizados += 1;
  }
  await recalcularPreciosMargenKits(client, [...changedKits]);
  return { actualizados: actualizados + kitsActualizados, productosAfectados: [...changedProducts], kitsAfectados: [...changedKits] };
}
