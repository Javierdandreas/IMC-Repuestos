import type { DbClient } from "@/lib/db-utils";
import {
  aplicarPreciosDesdeCostosReferencia,
  obtenerCostosReferenciaAutomaticos,
} from "@/lib/precios-automaticos";

const UMBRAL_APROBACION_AUTOMATICA = 5;

export type OrigenCambioCostoReferencia =
  | "CARGA_MANUAL_PROVEEDOR"
  | "CRITERIO_MASIVO"
  | "REGLAS_PROVEEDOR"
  | "DESCUENTOS_PROVEEDOR"
  | "EDICION_ITEM";

type CostoAntes = {
  idProducto: number;
  codigoItem: string;
  descripcionItem: string;
  costo: number | null;
};

type ContextoCambioCosto = {
  origen: OrigenCambioCostoReferencia;
  idProveedor?: number;
  detalle: string;
};

type CambioCalculado = CostoAntes & {
  criterioCosto: string;
  costoNuevo: number;
  porcentajeVariacion: number | null;
  estadoAprobacion: "PENDIENTE" | "APROBADO_AUTOMATICO";
};

function idsValidos(productIds: number[]) {
  return [...new Set(productIds.filter((id) => Number.isInteger(id) && id > 0))];
}

export async function obtenerProductosProveedor(client: DbClient, idProveedor: number) {
  const result = await client.query<{ id_producto: number }>(
    `SELECT DISTINCT id_producto FROM public.producto_proveedor WHERE id_proveedor = $1`,
    [idProveedor],
  );
  return idsValidos(result.rows.map((row) => Number(row.id_producto)));
}

/** Captura el costo elegido antes de una operacion que puede modificarlo. */
export async function capturarCostosReferencia(client: DbClient, productIds: number[]): Promise<CostoAntes[]> {
  const ids = idsValidos(productIds);
  if (ids.length === 0) return [];

  const result = await client.query<{
    id_producto: number;
    codigo_item: string;
    descripcion_item: string;
    costo: number | null;
  }>(
    `
      WITH tipo_costo AS (
        SELECT id
        FROM public.tipo_precio
        WHERE upper(trim(descripcion)) = 'PRECIO COSTO'
        ORDER BY id
        LIMIT 1
      )
      SELECT
        producto.id AS id_producto,
        COALESCE(producto.cod_unico, '') AS codigo_item,
        COALESCE(producto.descripcion, '') AS descripcion_item,
        precio.precio::float AS costo
      FROM public.productos producto
      LEFT JOIN tipo_costo ON true
      LEFT JOIN public.producto_precio precio
        ON precio.id_producto = producto.id
       AND precio.id_tipo_precio = tipo_costo.id
      WHERE producto.id = ANY($1::int[])
    `,
    [ids],
  );

  return result.rows.map((row) => ({
    idProducto: Number(row.id_producto),
    codigoItem: String(row.codigo_item),
    descripcionItem: String(row.descripcion_item),
    costo: row.costo === null ? null : Number(row.costo),
  }));
}

/**
 * Registra las variaciones posteriores a una regla y aplica solamente las que
 * no requieren revision. Los costos iguales se recalculan para conservar las
 * listas finales sincronizadas.
 */
export async function registrarCambiosCostoReferencia(
  client: DbClient,
  costosAntes: CostoAntes[],
  context: ContextoCambioCosto,
) {
  const ids = idsValidos(costosAntes.map((item) => item.idProducto));
  if (ids.length === 0) {
    return { cambios: 0, pendientes: 0, preciosRecalculados: 0, costosDisponibles: 0 };
  }

  const [costosNuevos, productos] = await Promise.all([
    obtenerCostosReferenciaAutomaticos(client, ids),
    client.query<{ id: number; criterio_costo: string }>(
      `SELECT id, criterio_costo FROM public.productos WHERE id = ANY($1::int[])`,
      [ids],
    ),
  ]);
  const costosNuevosPorProducto = new Map(costosNuevos.map((item) => [item.idProducto, item.costo]));
  const criteriosPorProducto = new Map(productos.rows.map((item) => [Number(item.id), String(item.criterio_costo)]));
  const cambios: CambioCalculado[] = costosAntes
    .map((item) => {
      const costoNuevo = costosNuevosPorProducto.get(item.idProducto);
      if (costoNuevo === undefined) return null;
      const porcentajeVariacion = item.costo === null || item.costo <= 0
        ? null
        : ((costoNuevo - item.costo) / item.costo) * 100;
      const estadoAprobacion = porcentajeVariacion !== null && Math.abs(porcentajeVariacion) <= UMBRAL_APROBACION_AUTOMATICA
        ? "APROBADO_AUTOMATICO"
        : "PENDIENTE";
      return {
        ...item,
        criterioCosto: criteriosPorProducto.get(item.idProducto) ?? "PROVEEDOR_UNICO",
        costoNuevo,
        porcentajeVariacion,
        estadoAprobacion,
      };
    })
    .filter((item): item is CambioCalculado => item !== null && Math.abs(item.costoNuevo - (item.costo ?? 0)) > 0.000001);

  if (cambios.length > 0) {
    await client.query(
      `
        UPDATE public.proveedor_importacion_cambio_costo
        SET estado_aprobacion = 'REEMPLAZADO', resuelto_at = NOW(), resuelto_por = NULL
        WHERE estado_aprobacion = 'PENDIENTE'
          AND id_producto = ANY($1::int[])
      `,
      [cambios.map((item) => item.idProducto)],
    );

    await client.query(
      `
        INSERT INTO public.proveedor_importacion_cambio_costo (
          id_producto, id_proveedor, codigo_item, descripcion_item, codigo_proveedor,
          criterio_costo, costo_anterior, costo_nuevo, estado_aprobacion,
          porcentaje_variacion, umbral_aprobacion, resuelto_at, origen, detalle_origen
        )
        SELECT * FROM UNNEST(
          $1::int[], $2::int[], $3::text[], $4::text[], $5::text[],
          $6::text[], $7::numeric[], $8::numeric[], $9::text[],
          $10::numeric[], $11::numeric[], $12::timestamptz[], $13::text[], $14::text[]
        ) AS valores(
          id_producto, id_proveedor, codigo_item, descripcion_item, codigo_proveedor,
          criterio_costo, costo_anterior, costo_nuevo, estado_aprobacion,
          porcentaje_variacion, umbral_aprobacion, resuelto_at, origen, detalle_origen
        )
      `,
      [
        cambios.map((item) => item.idProducto),
        cambios.map(() => context.idProveedor ?? null),
        cambios.map((item) => item.codigoItem),
        cambios.map((item) => item.descripcionItem),
        cambios.map(() => null),
        cambios.map((item) => item.criterioCosto),
        cambios.map((item) => item.costo),
        cambios.map((item) => item.costoNuevo),
        cambios.map((item) => item.estadoAprobacion),
        cambios.map((item) => item.porcentajeVariacion === null ? null : Math.round(item.porcentajeVariacion * 100) / 100),
        cambios.map(() => UMBRAL_APROBACION_AUTOMATICA),
        cambios.map((item) => item.estadoAprobacion === "APROBADO_AUTOMATICO" ? new Date() : null),
        cambios.map(() => context.origen),
        cambios.map(() => context.detalle),
      ],
    );
  }

  const cambiosPorProducto = new Map(cambios.map((item) => [item.idProducto, item]));
  const costosAplicables = costosNuevos.filter((item) => {
    const cambio = cambiosPorProducto.get(item.idProducto);
    return !cambio || cambio.estadoAprobacion === "APROBADO_AUTOMATICO";
  });
  const preciosRecalculados = await aplicarPreciosDesdeCostosReferencia(client, costosAplicables);

  return {
    cambios: cambios.length,
    pendientes: cambios.filter((item) => item.estadoAprobacion === "PENDIENTE").length,
    preciosRecalculados,
    costosDisponibles: costosNuevos.length,
  };
}
