import { AppError } from "@/lib/api-errors";
import { withTransaction } from "@/lib/db-utils";
import { registrarProductoActividad } from "@/lib/repos/producto-actividad";
import { calcularPrecioArsDesdeOrigen, obtenerCotizacionVigenteAjustada, recalcularPreciosMargenDesdeCosto } from "@/lib/precios-multimoneda";

type CostoGuardado = {
  costoArs: number;
  importeOrigen: number;
  codigoCotizacionCosto: string;
  ventasRecalculadas: number;
  modificado: boolean;
};

export async function guardarCostoManualItem(input: {
  idProducto: number;
  importeOrigen: number;
  codigoCotizacionEsperado: string;
  usuarioId?: number | null;
}): Promise<CostoGuardado> {
  if (!Number.isFinite(input.importeOrigen) || input.importeOrigen < 0 || input.importeOrigen > 999999999999.99) {
    throw new AppError("Ingresa un costo valido mayor o igual a cero", 400);
  }

  return withTransaction(async (client) => {
    const producto = await client.query<{ cod_unico: string; criterio_costo: string }>(
      "SELECT cod_unico, criterio_costo FROM public.productos WHERE id = $1 FOR UPDATE",
      [input.idProducto],
    );
    if (!producto.rows[0]) throw new AppError("Item no encontrado", 404);
    if (producto.rows[0].criterio_costo !== "MANUAL") {
      throw new AppError("El costo solo se edita desde la lista cuando el criterio es Manual", 409);
    }
    const tipoCosto = await client.query<{ id: number }>(
      "SELECT id FROM public.tipo_precio WHERE upper(trim(descripcion)) = 'PRECIO COSTO' ORDER BY id LIMIT 1",
    );
    if (!tipoCosto.rows[0]) throw new AppError("No existe la lista PRECIO COSTO", 503);
    const costo = await client.query<{
      precio: number;
      modo_calculo: string | null;
      importe_origen: number | null;
      moneda_origen: "ARS" | "USD" | "EUR" | "BRL" | null;
      referencia_cotizacion: "OFICIAL" | "BLUE" | "MEP" | "CCL" | null;
      lado_cotizacion: "COMPRA" | "VENTA" | null;
      tipo_recargo_cotizacion: "PORCENTAJE" | "MONTO_FIJO" | null;
      recargo_cotizacion: number | null;
    }>(
      `SELECT precio, modo_calculo, importe_origen, moneda_origen, referencia_cotizacion,
         lado_cotizacion, tipo_recargo_cotizacion, recargo_cotizacion
       FROM public.producto_precio
       WHERE id_producto = $1 AND id_tipo_precio = $2 FOR UPDATE`,
      [input.idProducto, tipoCosto.rows[0].id],
    );
    const actual = costo.rows[0];
    const extranjera = actual?.modo_calculo === "FIJO_MONEDA"
      && actual.moneda_origen && actual.moneda_origen !== "ARS"
      && actual.referencia_cotizacion && actual.lado_cotizacion;
    const codigoCotizacionCosto = extranjera
      ? `${actual.moneda_origen}_${actual.referencia_cotizacion}`
      : "ARS";
    if (input.codigoCotizacionEsperado !== codigoCotizacionCosto) {
      throw new AppError("La moneda del item cambio. Actualiza la lista antes de guardar.", 409);
    }
    const anterior = extranjera
      ? Number(actual.importe_origen ?? 0)
      : Number(actual?.precio ?? 0);
    const importeOrigen = extranjera ? input.importeOrigen : Math.round(input.importeOrigen * 100) / 100;
    if (Math.abs(anterior - importeOrigen) < 0.00000001) {
      return {
        costoArs: Number(actual?.precio ?? 0),
        importeOrigen: anterior,
        codigoCotizacionCosto,
        ventasRecalculadas: 0,
        modificado: false,
      };
    }

    const monedaOrigen = extranjera ? actual.moneda_origen : "ARS";
    const referencia = extranjera ? actual.referencia_cotizacion : null;
    const lado = extranjera ? actual.lado_cotizacion : null;
    const calculado = importeOrigen === 0
      ? { valor: 0, importeOrigen: 0, cotizacionUsada: extranjera
        ? (await obtenerCotizacionVigenteAjustada(client, monedaOrigen!, referencia!, lado!)).valor : 1,
        tipoRecargo: extranjera ? actual.tipo_recargo_cotizacion : null,
        recargo: extranjera ? Number(actual.recargo_cotizacion ?? 0) : null }
      : await calcularPrecioArsDesdeOrigen(client, {
        valor: importeOrigen,
        porcentaje_ganancia: 0,
        modo_calculo: extranjera ? "FIJO_MONEDA" : "FIJO_ARS",
        importe_origen: importeOrigen,
        moneda_origen: monedaOrigen,
        referencia_cotizacion: referencia,
        lado_cotizacion: lado,
        tipo_recargo_cotizacion: actual?.tipo_recargo_cotizacion,
        recargo_cotizacion: actual?.recargo_cotizacion,
      });
    if (!Number.isFinite(calculado.valor) || calculado.valor > 999999999999.99) {
      throw new AppError("El costo convertido supera el maximo permitido", 400);
    }

    await client.query(
      `INSERT INTO public.producto_precio (
         id_producto, id_tipo_precio, precio, porcentaje_ganancia, modo_calculo,
         importe_origen, moneda_origen, referencia_cotizacion, lado_cotizacion,
         tipo_recargo_cotizacion, recargo_cotizacion, cotizacion_usada, actualizado_origen_at
       ) VALUES ($1, $2, $3, 0, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
       ON CONFLICT (id_producto, id_tipo_precio) DO UPDATE SET
         precio = EXCLUDED.precio,
         porcentaje_ganancia = 0,
         modo_calculo = EXCLUDED.modo_calculo,
         importe_origen = EXCLUDED.importe_origen,
         moneda_origen = EXCLUDED.moneda_origen,
         referencia_cotizacion = EXCLUDED.referencia_cotizacion,
         lado_cotizacion = EXCLUDED.lado_cotizacion,
         tipo_recargo_cotizacion = EXCLUDED.tipo_recargo_cotizacion,
         recargo_cotizacion = EXCLUDED.recargo_cotizacion,
         cotizacion_usada = EXCLUDED.cotizacion_usada,
         actualizado_origen_at = NOW()`,
      [input.idProducto, tipoCosto.rows[0].id, calculado.valor,
        extranjera ? "FIJO_MONEDA" : "FIJO_ARS", calculado.importeOrigen, monedaOrigen,
        referencia, lado, calculado.tipoRecargo, calculado.recargo, calculado.cotizacionUsada],
    );
    const ventasRecalculadas = await recalcularPreciosMargenDesdeCosto(client, [input.idProducto]);
    await client.query(
      `UPDATE public.proveedor_importacion_cambio_costo
       SET estado_aprobacion = 'REEMPLAZADO', resuelto_at = NOW(), resuelto_por = NULL
       WHERE estado_aprobacion = 'PENDIENTE' AND id_producto = $1`,
      [input.idProducto],
    );
    await client.query(
      `INSERT INTO public.precio_moneda_historial
         (tipo_entidad, id_entidad, id_tipo_precio, motivo, modo_calculo,
          importe_origen, moneda_origen, cotizacion_usada, precio_ars)
       VALUES ('ITEM', $1, $2, 'EDICION_COSTO_MANUAL', $3, $4, $5, $6, $7)`,
      [input.idProducto, tipoCosto.rows[0].id, extranjera ? "FIJO_MONEDA" : "FIJO_ARS",
        calculado.importeOrigen, monedaOrigen, calculado.cotizacionUsada, calculado.valor],
    );
    await registrarProductoActividad({
      idProducto: input.idProducto,
      codigoProducto: producto.rows[0].cod_unico,
      tipo: "COSTO",
      titulo: "Costo manual actualizado desde Items",
      detalle: `${anterior} ${monedaOrigen} a ${importeOrigen} ${monedaOrigen}`,
      datos: { anterior, nuevo: importeOrigen, moneda: monedaOrigen, costoArs: calculado.valor },
      usuarioId: input.usuarioId,
    }, client);
    return {
      costoArs: calculado.valor,
      importeOrigen,
      codigoCotizacionCosto,
      ventasRecalculadas,
      modificado: true,
    };
  });
}
