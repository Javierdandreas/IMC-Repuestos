import { query } from "@/lib/db-utils";
import type { DbClient } from "@/lib/db-utils";
import type { ReglaCostoProveedor } from "@/lib/reglas-costo-proveedor";

export async function getProveedorReglasCosto(idProveedor: number): Promise<ReglaCostoProveedor[]> {
  const { rows } = await query(
    `
      SELECT
        regla.id,
        regla.id_proveedor,
        regla.nombre,
        regla.alcance,
        regla.id_marca,
        COALESCE(regla.id_marcas, ARRAY[]::int[]) AS id_marcas,
        marca.descripcion AS marca_descripcion,
        regla.tipo_ajuste,
        regla.valor::float AS valor,
        regla.orden,
        regla.activo,
        regla.condicion_tipo,
        regla.condicion_operador,
        regla.condicion_valor
      FROM public.proveedor_regla_costo regla
      LEFT JOIN public.marcas marca ON marca.id = regla.id_marca
      WHERE regla.id_proveedor = $1
      ORDER BY regla.orden ASC, regla.id ASC
    `,
    [idProveedor],
  );

  return rows as ReglaCostoProveedor[];
}

export async function replaceProveedorReglasCosto(
  client: DbClient,
  idProveedor: number,
  reglas: ReglaCostoProveedor[],
) {
  await client.query(`DELETE FROM public.proveedor_regla_costo WHERE id_proveedor = $1`, [idProveedor]);
  if (reglas.length === 0) return;

  for (const regla of reglas) {
    const marcas = regla.id_marcas?.length ? regla.id_marcas : regla.id_marca ? [regla.id_marca] : [];
    await client.query(
      `
        INSERT INTO public.proveedor_regla_costo (
          id_proveedor, nombre, alcance, id_marca, id_marcas, tipo_ajuste, valor, orden, activo,
          condicion_tipo, condicion_operador, condicion_valor
        )
        VALUES ($1, $2, $3, $4, $5::int[], $6, $7, $8, $9, $10, $11, $12)
      `,
      [
        idProveedor,
        regla.nombre,
        regla.alcance,
        regla.alcance === "MARCA" ? marcas[0] : null,
        regla.alcance === "MARCA" ? marcas : [],
        regla.tipo_ajuste,
        regla.valor,
        regla.orden,
        regla.activo,
        regla.condicion_tipo ?? "SIEMPRE",
        regla.condicion_operador ?? "IGUAL",
        regla.condicion_tipo === "STOCK_TEXTO" ? regla.condicion_valor?.trim() || null : null,
      ],
    );
  }
}
