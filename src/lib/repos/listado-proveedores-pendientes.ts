import { AppError } from "@/lib/api-errors";
import { query, withTransaction, type DbClient } from "@/lib/db-utils";
import { registrarProductoActividad } from "@/lib/repos/producto-actividad";
import { normalizeCode, normalizeText } from "@/utils/text";

export type TipoPendienteProveedor = "SIN_PROVEEDOR" | "SIN_CODIGO";

export type FiltrosPendientesProveedor = {
  tipo: TipoPendienteProveedor;
  page?: number;
  limit?: number;
  search?: string;
};

export type ItemProveedorPendiente = {
  idProducto: number;
  codigo: string;
  descripcion: string;
  marca: string | null;
  categoria: string | null;
  subcategoria: string | null;
  idProveedor: number | null;
  proveedor: string | null;
  precioLista: number | null;
  costoNeto: number | null;
};

function sqlBusqueda(search: string | undefined, aliasProveedor: string | null) {
  const normalized = normalizeText(search || "").slice(0, 100);
  if (!normalized) return { sql: "", params: [] as string[] };
  const pattern = `%${normalized}%`;
  const normalizedItem = "translate(upper(concat_ws(' ', producto.cod_unico, producto.descripcion, marca.descripcion, categoria.descripcion, subcategoria.descripcion)), 'ÁÉÍÓÚÜÑ', 'AEIOUUN')";
  const normalizedProvider = aliasProveedor
    ? ` OR translate(upper(COALESCE(${aliasProveedor}.descripcion, '')), 'ÁÉÍÓÚÜÑ', 'AEIOUUN') LIKE $1`
    : "";
  return {
    sql: ` AND (${normalizedItem} LIKE $1${normalizedProvider})`,
    params: [pattern],
  };
}

export async function getItemsProveedoresPendientes(filters: FiltrosPendientesProveedor) {
  const page = Math.max(1, Math.floor(filters.page || 1));
  const limit = Math.min(100, Math.max(10, Math.floor(filters.limit || 50)));
  const offset = (page - 1) * limit;
  const search = sqlBusqueda(filters.search, filters.tipo === "SIN_CODIGO" ? "proveedor" : null);
  const pagingParams = [...search.params, limit, offset];
  const limitParam = `$${search.params.length + 1}`;
  const offsetParam = `$${search.params.length + 2}`;

  const from = `
    FROM public.productos producto
    LEFT JOIN public.marcas marca ON marca.id = producto.id_marca
    LEFT JOIN public.subcategoria subcategoria ON subcategoria.id = producto.id_subcategoria
    LEFT JOIN public.categoria categoria ON categoria.id = subcategoria.id_categoria
  `;

  const base = filters.tipo === "SIN_PROVEEDOR"
    ? `
      SELECT producto.id AS id_producto, producto.cod_unico AS codigo, producto.descripcion,
        marca.descripcion AS marca, categoria.descripcion AS categoria, subcategoria.descripcion AS subcategoria,
        NULL::int AS id_proveedor, NULL::text AS proveedor, NULL::numeric AS precio_lista, NULL::numeric AS costo_neto
      ${from}
      WHERE NOT EXISTS (SELECT 1 FROM public.producto_proveedor relacion WHERE relacion.id_producto = producto.id)
      ${search.sql}
    `
    : `
      SELECT producto.id AS id_producto, producto.cod_unico AS codigo, producto.descripcion,
        marca.descripcion AS marca, categoria.descripcion AS categoria, subcategoria.descripcion AS subcategoria,
        relacion.id_proveedor, proveedor.descripcion AS proveedor,
        relacion.precio_lista_actual AS precio_lista, relacion.costo_actual AS costo_neto
      ${from}
      INNER JOIN public.producto_proveedor relacion ON relacion.id_producto = producto.id
      INNER JOIN public.proveedores proveedor ON proveedor.id = relacion.id_proveedor
      WHERE NULLIF(BTRIM(COALESCE(relacion.codigo_proveedor, '')), '') IS NULL
      ${search.sql}
    `;

  const [countResult, dataResult] = await Promise.all([
    query<{ total: number }>(`SELECT COUNT(*)::int AS total FROM (${base}) pendientes`, search.params),
    query<{
      id_producto: number; codigo: string; descripcion: string; marca: string | null; categoria: string | null; subcategoria: string | null;
      id_proveedor: number | null; proveedor: string | null; precio_lista: number | null; costo_neto: number | null;
    }>(`${base} ORDER BY categoria NULLS LAST, subcategoria NULLS LAST, marca NULLS LAST, codigo ASC LIMIT ${limitParam} OFFSET ${offsetParam}`, pagingParams),
  ]);

  const totalCount = Number(countResult.rows[0]?.total || 0);
  return {
    data: dataResult.rows.map((row): ItemProveedorPendiente => ({
      idProducto: Number(row.id_producto),
      codigo: String(row.codigo),
      descripcion: String(row.descripcion),
      marca: row.marca,
      categoria: row.categoria,
      subcategoria: row.subcategoria,
      idProveedor: row.id_proveedor === null ? null : Number(row.id_proveedor),
      proveedor: row.proveedor,
      precioLista: row.precio_lista === null ? null : Number(row.precio_lista),
      costoNeto: row.costo_neto === null ? null : Number(row.costo_neto),
    })),
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / limit)),
    page: Math.min(page, Math.max(1, Math.ceil(totalCount / limit))),
  };
}

function idsValidos(ids: number[]) {
  return [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
}

async function registrarAsignacionProveedor(client: DbClient, productIds: number[], proveedor: string, usuarioId: number | null | undefined) {
  if (!productIds.length) return;
  const productos = await client.query<{ id: number; cod_unico: string }>(
    "SELECT id, cod_unico FROM public.productos WHERE id = ANY($1::int[])",
    [productIds],
  );
  await Promise.all(productos.rows.map((producto) => registrarProductoActividad({
    idProducto: Number(producto.id),
    codigoProducto: String(producto.cod_unico),
    tipo: "EDICION",
    titulo: "Proveedor asociado desde pendientes",
    detalle: `Proveedor ${proveedor} asociado desde el listado de pendientes.`,
    usuarioId,
  }, client)));
}

export async function asignarProveedorAItemsSinProveedor(productIds: number[], idProveedor: number, usuarioId?: number | null) {
  const ids = idsValidos(productIds);
  if (!ids.length) throw new AppError("Selecciona al menos un item.", 400);
  if (!Number.isInteger(idProveedor) || idProveedor <= 0) throw new AppError("Selecciona un proveedor valido.", 400);

  return withTransaction(async (client) => {
    const proveedor = await client.query<{ descripcion: string }>("SELECT descripcion FROM public.proveedores WHERE id = $1", [idProveedor]);
    if (!proveedor.rows[0]) throw new AppError("El proveedor ya no existe.", 404);
    const assigned = await client.query<{ id_producto: number }>(`
      INSERT INTO public.producto_proveedor (id_producto, id_proveedor, codigo_proveedor)
      SELECT producto.id, $1, NULL
      FROM public.productos producto
      WHERE producto.id = ANY($2::int[])
        AND NOT EXISTS (SELECT 1 FROM public.producto_proveedor relacion WHERE relacion.id_producto = producto.id)
      ON CONFLICT (id_producto, id_proveedor) DO NOTHING
      RETURNING id_producto
    `, [idProveedor, ids]);
    const assignedIds = assigned.rows.map((row) => Number(row.id_producto));
    await registrarAsignacionProveedor(client, assignedIds, String(proveedor.rows[0].descripcion), usuarioId);
    return { assigned: assignedIds.length, omitted: ids.length - assignedIds.length };
  });
}

export async function actualizarCodigoProveedorPendiente(idProducto: number, idProveedor: number, codigoProveedor: string, usuarioId?: number | null) {
  const codigo = normalizeCode(codigoProveedor).slice(0, 100);
  if (!codigo) throw new AppError("Ingresa un codigo de proveedor valido.", 400);

  return withTransaction(async (client) => {
    const updated = await client.query<{ cod_unico: string; proveedor: string }>(`
      UPDATE public.producto_proveedor relacion
      SET codigo_proveedor = $3
      FROM public.productos producto, public.proveedores proveedor
      WHERE relacion.id_producto = $1
        AND relacion.id_proveedor = $2
        AND producto.id = relacion.id_producto
        AND proveedor.id = relacion.id_proveedor
      RETURNING producto.cod_unico, proveedor.descripcion AS proveedor
    `, [idProducto, idProveedor, codigo]);
    const row = updated.rows[0];
    if (!row) throw new AppError("La relacion con el proveedor ya no existe.", 404);
    await registrarProductoActividad({
      idProducto,
      codigoProducto: String(row.cod_unico),
      tipo: "EDICION",
      titulo: "Codigo de proveedor actualizado",
      detalle: `Codigo ${codigo} asignado a ${row.proveedor} desde el listado de pendientes.`,
      usuarioId,
    }, client);
    return { codigoProveedor: codigo };
  });
}
