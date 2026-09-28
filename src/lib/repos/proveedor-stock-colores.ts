import { query } from "@/lib/db-utils";
import type { DbClient } from "@/lib/db-utils";
import type { EstadoStockProveedor } from "@/lib/stock-proveedor";

export type ReglaColorStockProveedor = {
  color: string;
  estado: EstadoStockProveedor;
  activo: boolean;
};

export async function getProveedorReglasColorStock(idProveedor: number): Promise<ReglaColorStockProveedor[]> {
  const { rows } = await query(
    `
      SELECT color, estado, activo
      FROM public.proveedor_stock_color_regla
      WHERE id_proveedor = $1
      ORDER BY color
    `,
    [idProveedor],
  );
  return rows as ReglaColorStockProveedor[];
}

export async function upsertProveedorReglasColorStock(
  client: DbClient,
  idProveedor: number,
  reglas: ReglaColorStockProveedor[],
) {
  if (reglas.length === 0) return;

  await client.query(
    `
      INSERT INTO public.proveedor_stock_color_regla (id_proveedor, color, estado, activo, updated_at)
      SELECT $1, * FROM UNNEST($2::text[], $3::text[], $4::boolean[], $5::timestamptz[])
      ON CONFLICT (id_proveedor, color) DO UPDATE
      SET estado = EXCLUDED.estado,
          activo = EXCLUDED.activo,
          updated_at = EXCLUDED.updated_at
    `,
    [
      idProveedor,
      reglas.map((regla) => regla.color),
      reglas.map((regla) => regla.estado),
      reglas.map((regla) => regla.activo),
      reglas.map(() => new Date().toISOString()),
    ],
  );
}
