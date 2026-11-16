import { type DbClient, withTransaction } from "@/lib/db-utils";
import { AppError } from "@/lib/api-errors";
import { recalcularCostosProveedorProductos } from "@/lib/costos-proveedor";
import { capturarCostosReferencia, registrarCambiosCostoReferencia } from "@/lib/cambios-costo-referencia";
import { CRITERIOS_COSTO, type CriterioCosto } from "@/lib/costos";

export type TipoItemMasivo = "ITEM" | "KIT";
export type CampoCambioMasivo =
  | "CLASIFICACION"
  | "MARCA"
  | "PROVEEDOR"
  | "UBICACION"
  | "STOCK_MINIMO"
  | "OBSERVACION"
  | "PALABRAS_CLAVE"
  | "PIEZA"
  | "CRITERIO_COSTO"
  | "PRECIOS";

type VariacionPrecioMasivo = "INCREMENTO" | "DESCUENTO";
type TipoVariacionPrecioMasivo = "MONTO_FIJO" | "PORCENTAJE";

export type CambioMasivoItemsInput = {
  items: Array<{ id: number; tipo: TipoItemMasivo }>;
  campo: CampoCambioMasivo;
  idCategoria?: number;
  idSubcategoria?: number;
  idMarca?: number;
  idProveedor?: number;
  idUbicacion?: number;
  idPieza?: number;
  criterioCosto?: CriterioCosto;
  idTipoPrecio?: number;
  variacionPrecio?: VariacionPrecioMasivo;
  tipoVariacionPrecio?: TipoVariacionPrecioMasivo;
  importePrecio?: number;
  stockMinimo?: number;
  texto?: string;
  usuarioId?: number | null;
};

type ProductoActualizado = { id: number; cod_unico: string };

function idsPorTipo(items: CambioMasivoItemsInput["items"], tipo: TipoItemMasivo) {
  return [...new Set(items.filter((item) => item.tipo === tipo).map((item) => item.id))];
}

async function asegurarExiste(
  table: "categoria" | "subcategoria" | "marcas" | "proveedores" | "ubicaciones",
  id: number | undefined,
  mensaje: string,
) {
  if (!id) throw new AppError(mensaje, 400);
  return id;
}

export async function aplicarCambioMasivoItems(input: CambioMasivoItemsInput) {
  const itemIds = idsPorTipo(input.items, "ITEM");
  const kitIds = idsPorTipo(input.items, "KIT");

  if (itemIds.length + kitIds.length === 0) {
    throw new AppError("Selecciona al menos un item o kit", 400);
  }

  return withTransaction(async (client) => {
    let productosActualizados: ProductoActualizado[] = [];
    let kitsActualizados = 0;

    const actualizarProductos = async (sql: string, params: unknown[], titulo: string, detalle: string) => {
      if (itemIds.length === 0) return;
      const result = await client.query<ProductoActualizado>(sql, params);
      productosActualizados = result.rows;
      await registrarActividadesMasivas(client, result.rows, titulo, detalle, input.usuarioId);
    };

    if (input.campo === "CLASIFICACION") {
      const idCategoria = await asegurarExiste("categoria", input.idCategoria, "Selecciona una categoria");
      const idSubcategoria = await asegurarExiste("subcategoria", input.idSubcategoria, "Selecciona una subcategoria");
      const subcategoria = await client.query<{ id: number }>(
        "SELECT id FROM public.subcategoria WHERE id = $1 AND id_categoria = $2",
        [idSubcategoria, idCategoria],
      );
      if (subcategoria.rowCount === 0) throw new AppError("La subcategoria no pertenece a la categoria seleccionada", 400);

      await actualizarProductos(
        "UPDATE public.productos SET id_subcategoria = $1 WHERE id = ANY($2::int[]) RETURNING id, cod_unico",
        [idSubcategoria, itemIds],
        "Clasificacion actualizada masivamente",
        "Categoria y subcategoria actualizadas desde el listado general",
      );
      if (kitIds.length > 0) {
        const result = await client.query(
          "UPDATE public.kits SET id_categoria = $1, id_subcategoria = $2 WHERE id = ANY($3::int[])",
          [idCategoria, idSubcategoria, kitIds],
        );
        kitsActualizados = result.rowCount || 0;
      }
    }

    if (input.campo === "MARCA") {
      const idMarca = await asegurarExiste("marcas", input.idMarca, "Selecciona una marca");
      await actualizarProductos(
        "UPDATE public.productos SET id_marca = $1 WHERE id = ANY($2::int[]) RETURNING id, cod_unico",
        [idMarca, itemIds],
        "Marca actualizada masivamente",
        "Marca actualizada desde el listado general",
      );
      if (kitIds.length > 0) {
        const result = await client.query("UPDATE public.kits SET id_marca = $1 WHERE id = ANY($2::int[])", [idMarca, kitIds]);
        kitsActualizados = result.rowCount || 0;
      }
    }

    if (input.campo === "PROVEEDOR") {
      const idProveedor = await asegurarExiste("proveedores", input.idProveedor, "Selecciona un proveedor");
      if (itemIds.length > 0) {
        const result = await client.query<ProductoActualizado>(
          `WITH actualizados AS (
             INSERT INTO public.producto_proveedor (id_producto, id_proveedor, codigo_proveedor)
             SELECT id, $1, NULL FROM public.productos WHERE id = ANY($2::int[])
             ON CONFLICT (id_producto, id_proveedor) DO NOTHING
             RETURNING id_producto
           )
           SELECT p.id, p.cod_unico
           FROM public.productos p
           JOIN actualizados a ON a.id_producto = p.id`,
          [idProveedor, itemIds],
        );
        productosActualizados = result.rows;
        await registrarActividadesMasivas(
          client,
          result.rows,
          "Proveedor asociado masivamente",
          "Proveedor asociado desde el listado general",
          input.usuarioId,
        );
      }
    }

    if (input.campo === "UBICACION") {
      const idUbicacion = await asegurarExiste("ubicaciones", input.idUbicacion, "Selecciona una ubicacion");
      await actualizarProductos(
        "UPDATE public.productos SET id_ubicacion = $1 WHERE id = ANY($2::int[]) RETURNING id, cod_unico",
        [idUbicacion, itemIds],
        "Ubicacion actualizada masivamente",
        "Ubicacion actualizada desde el listado general",
      );
    }

    if (input.campo === "STOCK_MINIMO") {
      if (!Number.isInteger(input.stockMinimo) || Number(input.stockMinimo) < 0) {
        throw new AppError("Ingresa un stock minimo valido", 400);
      }
      const stockMinimo = Number(input.stockMinimo);
      await actualizarProductos(
        "UPDATE public.productos SET stock_minimo = $1 WHERE id = ANY($2::int[]) RETURNING id, cod_unico",
        [stockMinimo, itemIds],
        "Stock minimo actualizado masivamente",
        `Stock minimo establecido en ${stockMinimo} desde el listado general`,
      );
      if (kitIds.length > 0) {
        const result = await client.query("UPDATE public.kits SET stock_minimo = $1 WHERE id = ANY($2::int[])", [stockMinimo, kitIds]);
        kitsActualizados = result.rowCount || 0;
      }
    }

    if (input.campo === "OBSERVACION") {
      const texto = String(input.texto || "").trim() || null;
      await actualizarProductos(
        "UPDATE public.productos SET observacion = $1 WHERE id = ANY($2::int[]) RETURNING id, cod_unico",
        [texto, itemIds],
        "Observacion actualizada masivamente",
        "Observacion actualizada desde el listado general",
      );
      if (kitIds.length > 0) {
        const result = await client.query("UPDATE public.kits SET observacion = $1 WHERE id = ANY($2::int[])", [texto, kitIds]);
        kitsActualizados = result.rowCount || 0;
      }
    }

    if (input.campo === "PALABRAS_CLAVE") {
      const texto = String(input.texto || "").trim() || null;
      await actualizarProductos(
        "UPDATE public.productos SET palabra_clave = $1 WHERE id = ANY($2::int[]) RETURNING id, cod_unico",
        [texto, itemIds],
        "Palabras clave actualizadas masivamente",
        "Palabras clave actualizadas desde el listado general",
      );
    }

    if (input.campo === "PIEZA") {
      if (!input.idPieza) throw new AppError("Selecciona un numero de pieza", 400);
      const pieza = await client.query<{ id: number; codigo_pieza: number; descripcion: string; id_subcategoria: number }>(
        "SELECT id, codigo_pieza, descripcion, id_subcategoria FROM public.pieza WHERE id = $1",
        [input.idPieza],
      );
      const seleccionada = pieza.rows[0];
      if (!seleccionada) throw new AppError("El numero de pieza seleccionado ya no existe", 404);
      await actualizarProductos(
        `UPDATE public.productos
         SET id_pieza = $1, descripcion = $2, id_subcategoria = $3, palabra_clave = NULL
         WHERE id = ANY($4::int[])
         RETURNING id, cod_unico`,
        [seleccionada.id, seleccionada.descripcion, seleccionada.id_subcategoria, itemIds],
        "Numero de pieza asignado masivamente",
        `Asignado al numero de pieza ${seleccionada.codigo_pieza} desde el listado general`,
      );
    }

    if (input.campo === "PRECIOS") {
      if (!input.idTipoPrecio) throw new AppError("Selecciona la lista de precio a modificar", 400);
      if (input.variacionPrecio !== "INCREMENTO" && input.variacionPrecio !== "DESCUENTO") {
        throw new AppError("Selecciona si el precio aumenta o disminuye", 400);
      }
      if (input.tipoVariacionPrecio !== "MONTO_FIJO" && input.tipoVariacionPrecio !== "PORCENTAJE") {
        throw new AppError("Selecciona si la variacion es por monto o porcentaje", 400);
      }
      const importe = Number(input.importePrecio);
      if (!Number.isFinite(importe) || importe <= 0) {
        throw new AppError("Ingresa un importe mayor a cero", 400);
      }

      const tipoObjetivo = await client.query<{ id: number; descripcion: string }>(
        "SELECT id, descripcion FROM public.tipo_precio WHERE id = $1 LIMIT 1",
        [input.idTipoPrecio],
      );
      const tipo = tipoObjetivo.rows[0];
      if (!tipo) throw new AppError("La lista de precio seleccionada ya no existe", 404);

      const factor = input.variacionPrecio === "INCREMENTO" ? 1 : -1;
      const resultado = await client.query<ProductoActualizado>(
        `WITH tipo_costo AS (
           SELECT id FROM public.tipo_precio
           WHERE upper(trim(descripcion)) = 'PRECIO COSTO'
           ORDER BY id
           LIMIT 1
         ), base AS (
           SELECT
             producto.id AS id_producto,
             producto.cod_unico,
             costo.precio AS costo_actual,
             objetivo.precio AS precio_actual,
             objetivo.porcentaje_ganancia AS margen_actual,
             objetivo.modo_calculo AS modo_actual,
             COALESCE(objetivo.precio, CASE
               WHEN costo.precio > 0 THEN ROUND(costo.precio * (1 + COALESCE(tipo_objetivo.margen_default, 0) / 100), 2)
               ELSE 0
             END) AS base_precio,
             COALESCE(objetivo.modo_calculo, 'MARGEN_COSTO') AS modo_calculo
           FROM public.productos producto
           CROSS JOIN tipo_costo
           INNER JOIN public.tipo_precio tipo_objetivo ON tipo_objetivo.id = $1
           LEFT JOIN public.producto_precio costo
             ON costo.id_producto = producto.id AND costo.id_tipo_precio = tipo_costo.id
           LEFT JOIN public.producto_precio objetivo
             ON objetivo.id_producto = producto.id AND objetivo.id_tipo_precio = $1
           WHERE producto.id = ANY($2::int[])
         ), calculados AS (
           SELECT *, ROUND(GREATEST(0, CASE
             WHEN $4::text = 'PORCENTAJE' THEN base_precio * (1 + ($3::numeric * $5::numeric) / 100)
             ELSE base_precio + ($3::numeric * $5::numeric)
           END), 2) AS nuevo_precio
           FROM base
         ), actualizados AS (
           INSERT INTO public.producto_precio (id_producto, id_tipo_precio, precio, porcentaje_ganancia, modo_calculo)
           SELECT
             id_producto,
             $1,
             nuevo_precio,
             CASE
               WHEN modo_calculo = 'MARGEN_COSTO' AND COALESCE(costo_actual, 0) > 0
                 THEN ROUND(((nuevo_precio / costo_actual) - 1) * 100, 4)
               ELSE COALESCE(margen_actual, 0)
             END,
             CASE
               WHEN modo_calculo = 'FIJO_MONEDA' THEN 'FIJO_ARS'
               WHEN modo_calculo = 'MARGEN_COSTO' AND COALESCE(costo_actual, 0) <= 0 THEN 'FIJO_ARS'
               ELSE modo_calculo
             END
           FROM calculados
           ON CONFLICT (id_producto, id_tipo_precio) DO UPDATE
           SET precio = EXCLUDED.precio,
               porcentaje_ganancia = EXCLUDED.porcentaje_ganancia,
               modo_calculo = EXCLUDED.modo_calculo
           RETURNING id_producto
         )
         SELECT producto.id, producto.cod_unico
         FROM public.productos producto
         INNER JOIN actualizados ON actualizados.id_producto = producto.id`,
        [input.idTipoPrecio, itemIds, factor, input.tipoVariacionPrecio, importe],
      );
      productosActualizados = resultado.rows;

      const esCosto = String(tipo.descripcion).trim().toUpperCase() === "PRECIO COSTO";
      if (esCosto && itemIds.length > 0) {
        await client.query(
          "UPDATE public.productos SET criterio_costo = 'MANUAL' WHERE id = ANY($1::int[])",
          [itemIds],
        );
        await client.query(
          `WITH tipo_costo AS (
             SELECT id FROM public.tipo_precio
             WHERE upper(trim(descripcion)) = 'PRECIO COSTO'
             ORDER BY id
             LIMIT 1
           )
           UPDATE public.producto_precio costo
           SET porcentaje_ganancia = 0,
               modo_calculo = 'FIJO_ARS'
           FROM tipo_costo
           WHERE costo.id_producto = ANY($1::int[])
             AND costo.id_tipo_precio = tipo_costo.id`,
          [itemIds],
        );
        await client.query(
          `WITH tipo_costo AS (
             SELECT id FROM public.tipo_precio
             WHERE upper(trim(descripcion)) = 'PRECIO COSTO'
             ORDER BY id
             LIMIT 1
           )
           UPDATE public.producto_precio venta
           SET precio = ROUND(costo.precio * (1 + COALESCE(venta.porcentaje_ganancia, 0) / 100), 2)
           FROM public.producto_precio costo
           CROSS JOIN tipo_costo
           WHERE venta.id_producto = costo.id_producto
             AND venta.id_producto = ANY($1::int[])
             AND venta.id_tipo_precio <> tipo_costo.id
             AND costo.id_tipo_precio = tipo_costo.id
             AND COALESCE(venta.modo_calculo, 'MARGEN_COSTO') = 'MARGEN_COSTO'`,
          [itemIds],
        );
      }

      const variacion = `${input.variacionPrecio === "INCREMENTO" ? "Incremento" : "Descuento"} de ${importe}${input.tipoVariacionPrecio === "PORCENTAJE" ? "%" : " ARS"}`;
      await registrarActividadesMasivas(
        client,
        resultado.rows,
        "Precio actualizado masivamente",
        `${variacion} aplicado a ${tipo.descripcion} desde el listado general`,
        input.usuarioId,
      );
    }

    let seguimientoCosto: { cambios: number; pendientes: number; preciosRecalculados: number; costosDisponibles: number } | null = null;
    if (input.campo === "CRITERIO_COSTO") {
      const criterio = input.criterioCosto;
      if (!criterio || !CRITERIOS_COSTO.includes(criterio)) {
        throw new AppError("Selecciona un criterio de costo valido", 400);
      }

      const costosAntes = await capturarCostosReferencia(client, itemIds);
      await actualizarProductos(
        `UPDATE public.productos
         SET criterio_costo = $1
         WHERE id = ANY($2::int[])
         RETURNING id, cod_unico`,
        [criterio, itemIds],
        "Criterio de costo actualizado masivamente",
        `Criterio de costo establecido en ${criterio} desde el listado general`,
      );
      await recalcularCostosProveedorProductos(client, { productIds: itemIds });
      seguimientoCosto = await registrarCambiosCostoReferencia(client, costosAntes, {
        origen: "CRITERIO_MASIVO",
        detalle: `Criterio de costo asignado desde el listado general: ${criterio}.`,
      });
    }

    return {
      itemsActualizados: productosActualizados.length,
      kitsActualizados,
      kitsOmitidos: ["PROVEEDOR", "UBICACION", "PALABRAS_CLAVE", "PIEZA", "CRITERIO_COSTO", "PRECIOS"].includes(input.campo) ? kitIds.length : 0,
      cambiosCosto: seguimientoCosto?.cambios ?? 0,
      cambiosPendientes: seguimientoCosto?.pendientes ?? 0,
      preciosRecalculados: seguimientoCosto?.preciosRecalculados ?? 0,
    };
  });
}

async function registrarActividadesMasivas(
  client: DbClient,
  productos: ProductoActualizado[],
  titulo: string,
  detalle: string,
  usuarioId?: number | null,
) {
  if (productos.length === 0) return;
  await client.query(
    `
      INSERT INTO public.producto_actividad (
        id_producto, codigo_producto, tipo, titulo, detalle, datos, usuario_id
      )
      SELECT id_producto, codigo_producto, 'EDICION', $3, $4, '{}'::jsonb, $5
      FROM UNNEST($1::int[], $2::text[]) AS valores(id_producto, codigo_producto)
    `,
    [
      productos.map((producto) => producto.id),
      productos.map((producto) => producto.cod_unico),
      titulo,
      detalle,
      usuarioId ?? null,
    ],
  );
}
