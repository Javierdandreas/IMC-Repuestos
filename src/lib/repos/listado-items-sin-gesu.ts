import { query } from "@/lib/db-utils";
import { normalizeText } from "@/utils/text";

const ORIGIN = "GESU_EXTERNO";

export type ItemSinGesu = {
  idProducto: number;
  codigo: string;
  descripcion: string;
  marca: string | null;
  categoria: string | null;
  subcategoria: string | null;
  stock: number;
};

export async function getItemsSinVinculoGesu(options: { page?: number; limit?: number; search?: string }) {
  const page = Math.max(1, Math.floor(options.page || 1));
  const limit = Math.min(100, Math.max(10, Math.floor(options.limit || 50)));
  const term = normalizeText(options.search || "").slice(0, 100);
  const params: unknown[] = [ORIGIN];
  const filters = [
    `EXISTS (
      SELECT 1
      FROM public.catalogo_externo_sincronizacion AS sincronizacion
      WHERE sincronizacion.origen = $1
    )`,
    `NOT EXISTS (
      SELECT 1
      FROM public.catalogo_externo_item AS externo
      JOIN public.catalogo_externo_sincronizacion AS sincronizacion
        ON sincronizacion.id = externo.id_sincronizacion
      WHERE sincronizacion.origen = $1
        AND externo.tipo = 'PRODUCTO'
        AND UPPER(BTRIM(externo.codigo)) = UPPER(BTRIM(producto.cod_unico))
    )`,
  ];
  if (term) {
    params.push(`%${term}%`);
    filters.push(`translate(upper(concat_ws(' ', producto.cod_unico, producto.descripcion, marca.descripcion, categoria.descripcion, subcategoria.descripcion)), 'ÁÉÍÓÚÜÑ', 'AEIOUUN') LIKE $${params.length}`);
  }
  const where = filters.join(" AND ");
  const from = `
    FROM public.productos AS producto
    LEFT JOIN public.marcas AS marca ON marca.id = producto.id_marca
    LEFT JOIN public.subcategoria AS subcategoria ON subcategoria.id = producto.id_subcategoria
    LEFT JOIN public.categoria AS categoria ON categoria.id = subcategoria.id_categoria
    WHERE ${where}
  `;
  const [count, rows] = await Promise.all([
    query<{ total: number }>(`SELECT COUNT(*)::int AS total ${from}`, params),
    query<{
      id_producto: number;
      codigo: string;
      descripcion: string;
      marca: string | null;
      categoria: string | null;
      subcategoria: string | null;
      stock: number;
    }>(
      `SELECT producto.id AS id_producto, producto.cod_unico AS codigo, producto.descripcion,
        marca.descripcion AS marca, categoria.descripcion AS categoria, subcategoria.descripcion AS subcategoria,
        COALESCE(producto.stock, 0)::int AS stock
       ${from}
       ORDER BY categoria NULLS LAST, subcategoria NULLS LAST, marca NULLS LAST, producto.cod_unico ASC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, (page - 1) * limit],
    ),
  ]);
  const totalCount = Number(count.rows[0]?.total || 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  return {
    data: rows.rows.map((row): ItemSinGesu => ({
      idProducto: Number(row.id_producto),
      codigo: String(row.codigo),
      descripcion: String(row.descripcion),
      marca: row.marca,
      categoria: row.categoria,
      subcategoria: row.subcategoria,
      stock: Number(row.stock || 0),
    })),
    totalCount,
    totalPages,
    page: Math.min(page, totalPages),
  };
}
