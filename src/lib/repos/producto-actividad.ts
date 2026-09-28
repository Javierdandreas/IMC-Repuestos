import type { DbClient } from "@/lib/db-utils";
import { query } from "@/lib/db-utils";

export type TipoActividadProducto = "ALTA" | "EDICION" | "STOCK" | "COSTO" | "PRECIO";

export type ProductoActividadInput = {
  idProducto: number;
  codigoProducto: string;
  tipo: TipoActividadProducto;
  titulo: string;
  detalle?: string | null;
  datos?: Record<string, unknown>;
  usuarioId?: number | null;
};

export type ProductoActividad = ProductoActividadInput & {
  id: number;
  usuario_nombre: string | null;
  created_at: string;
};

export async function registrarProductoActividad(
  actividad: ProductoActividadInput,
  client?: DbClient
) {
  const executor = client ?? { query };
  await executor.query(
    `
      INSERT INTO public.producto_actividad (
        id_producto, codigo_producto, tipo, titulo, detalle, datos, usuario_id
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
    `,
    [
      actividad.idProducto,
      actividad.codigoProducto,
      actividad.tipo,
      actividad.titulo,
      actividad.detalle || null,
      JSON.stringify(actividad.datos || {}),
      actividad.usuarioId || null,
    ]
  );
}

export async function getProductoActividad(idProducto: number, limit = 40): Promise<ProductoActividad[]> {
  const result = await query<ProductoActividad>(
    `
      SELECT
        a.id,
        a.id_producto AS "idProducto",
        a.codigo_producto AS "codigoProducto",
        a.tipo,
        a.titulo,
        a.detalle,
        a.datos,
        a.usuario_id AS "usuarioId",
        COALESCE(
          NULLIF(TRIM(CONCAT_WS(' ', du.nombre, du.apellido)), ''),
          u.nombre_usuario,
          'Sistema'
        ) AS usuario_nombre,
        a.created_at
      FROM public.producto_actividad a
      LEFT JOIN public.usuario u ON u.id = a.usuario_id
      LEFT JOIN public.detalle_usuario du ON du.id = a.usuario_id
      WHERE a.id_producto = $1
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT $2
    `,
    [idProducto, Math.max(1, Math.min(limit, 100))]
  );

  return result.rows;
}
