import { query, withTransaction } from "@/lib/db-utils";
import { revalidateTag } from "next/cache";
import type { Ubicacion, UbicacionSector } from "../types/ubicaciones";
import { sanitizeRequiredString as cleanDescripcion } from "@/utils/sanitization";

function getOrderByClause(): string {
  const extractNum = (expr: string) => `(CASE WHEN ${expr} ~ '^[0-9]+$' THEN ${expr}::BIGINT ELSE NULL END)`;

  return `
    sector_codigo ASC NULLS LAST,
    estanteria ASC NULLS LAST,
    nivel ASC NULLS LAST,
    posicion ASC NULLS LAST,
    (regexp_match(descripcion, '^[A-Z]+'))[1] ASC NULLS FIRST,
    ${extractNum("(regexp_match(descripcion, '[0-9]+'))[1]")} ASC NULLS FIRST,
    ${extractNum("split_part(descripcion, '-', 2)")} ASC NULLS FIRST,
    ${extractNum("split_part(descripcion, '-', 3)")} ASC NULLS FIRST,
    ${extractNum("split_part(descripcion, '-', 4)")} ASC NULLS FIRST
  `;
}

// --------------------------------------------------------------------------------
// SECTORES
// --------------------------------------------------------------------------------

export async function listarSectores(): Promise<UbicacionSector[]> {
  const { rows } = await query(`SELECT * FROM ubicacion_sector ORDER BY codigo ASC`);
  return rows as UbicacionSector[];
}

export async function crearSector(codigo: string, descripcion?: string): Promise<UbicacionSector> {
  const upperCodigo = codigo.toUpperCase();
  if (!/^[A-Z]$/.test(upperCodigo)) {
    throw new Error("El código de sector debe ser una única letra A-Z");
  }

  return await withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO ubicacion_sector (codigo, descripcion) 
       VALUES ($1, $2)
       ON CONFLICT (codigo) DO UPDATE SET descripcion = EXCLUDED.descripcion
       RETURNING *`,
      [upperCodigo, descripcion || null]
    );
    revalidateTag("meta");
    return rows[0] as UbicacionSector;
  });
}

// --------------------------------------------------------------------------------
// UBICACIONES (CRUD Básico / Legacy)
// --------------------------------------------------------------------------------

export async function getUbicaciones(): Promise<Ubicacion[]> {
  return listarUbicaciones();
}

export async function listarUbicaciones(): Promise<Ubicacion[]> {
  const { rows } = await query(`SELECT * FROM ubicaciones ORDER BY ${getOrderByClause()}`);
  return rows as Ubicacion[];
}

export async function createUbicacion(descripcion: unknown): Promise<Ubicacion> {
  const clean = cleanDescripcion(descripcion);
  if (!clean) throw new Error("La descripción es obligatoria");

  return await withTransaction(async (client) => {
    const duplicate = await client.query(
      `SELECT 1 FROM ubicaciones WHERE LOWER(TRIM(descripcion)) = LOWER(TRIM($1)) LIMIT 1`,
      [clean]
    );
    if (duplicate.rows.length > 0) {
      const error = new Error(`Ya existe una ubicación con esa descripción`);
      (error as any).status = 409;
      throw error;
    }

    const { rows } = await client.query(
      `INSERT INTO ubicaciones (descripcion) VALUES ($1) RETURNING *`,
      [clean]
    );

    revalidateTag("meta");
    return rows[0] as Ubicacion;
  });
}

export async function updateUbicacion(id: string | number, descripcion: unknown): Promise<Ubicacion> {
  const clean = cleanDescripcion(descripcion);
  if (!clean) throw new Error("La descripción es obligatoria");

  return await withTransaction(async (client) => {
    const duplicate = await client.query(
      `SELECT 1 FROM ubicaciones WHERE LOWER(TRIM(descripcion)) = LOWER(TRIM($1)) AND id <> $2 LIMIT 1`,
      [clean, id]
    );
    if (duplicate.rows.length > 0) {
      const error = new Error(`Ya existe una ubicación con esa descripción`);
      (error as any).status = 409;
      throw error;
    }

    const { rows, rowCount } = await client.query(
      `UPDATE ubicaciones SET descripcion = $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [clean, id]
    );
    if (!rowCount) {
      const error = new Error(`Ubicación no encontrada`);
      (error as any).status = 404;
      throw error;
    }

    revalidateTag("meta");
    return rows[0] as Ubicacion;
  });
}

export async function deleteUbicacion(id: string | number): Promise<void> {
  return await withTransaction(async (client) => {
    const uso = await client.query(`SELECT COUNT(*)::int AS total FROM productos WHERE id_ubicacion = $1`, [id]);
    if (uso.rows[0]?.total > 0) {
      const error = new Error('No se puede borrar la ubicación porque está asociada a uno o más productos');
      (error as any).status = 409;
      throw error;
    }

    const result = await client.query(`DELETE FROM ubicaciones WHERE id = $1 RETURNING *`, [id]);
    if (!result.rowCount) {
      const error = new Error(`Ubicación no encontrada`);
      (error as any).status = 404;
      throw error;
    }

    revalidateTag("meta");
  });
}

// --------------------------------------------------------------------------------
// UBICACIONES ESTRUCTURADAS
// --------------------------------------------------------------------------------

export async function buscarUbicacionPorCodigo(codigo: string): Promise<Ubicacion | null> {
  const { rows } = await query(`SELECT * FROM ubicaciones WHERE codigo = $1 LIMIT 1`, [codigo]);
  return rows.length > 0 ? (rows[0] as Ubicacion) : null;
}

export async function buscarUbicacionPorBarcode(codigo_barra: string): Promise<Ubicacion | null> {
  const { rows } = await query(`SELECT * FROM ubicaciones WHERE codigo_barra = $1 LIMIT 1`, [codigo_barra]);
  return rows.length > 0 ? (rows[0] as Ubicacion) : null;
}

export async function generarUbicaciones(
  sector_codigo: string,
  estanterias: number,
  niveles: number,
  posiciones: number
): Promise<{ generadas: number; existentes: number }> {
  return await withTransaction(async (client) => {
    // 1. Verify sector exists
    const sectorRes = await client.query(`SELECT codigo FROM ubicacion_sector WHERE codigo = $1`, [sector_codigo]);
    if (sectorRes.rows.length === 0) {
      throw new Error(`El sector ${sector_codigo} no existe.`);
    }

    let generadas = 0;
    let existentes = 0;

    for (let e = 1; e <= estanterias; e++) {
      for (let n = 1; n <= niveles; n++) {
        for (let p = 1; p <= posiciones; p++) {
          const codigo = `${sector_codigo}${e}-${n}-${p}`;
          const codigo_barra = `UBI:${codigo}`;
          
          // Check if it exists structured
          const existeRes = await client.query(
            `SELECT 1 FROM ubicaciones WHERE sector_codigo = $1 AND estanteria = $2 AND nivel = $3 AND posicion = $4`,
            [sector_codigo, e, n, p]
          );

          if (existeRes.rows.length > 0) {
            existentes++;
            continue;
          }

          // Check if exists by codigo or codigo_barra just in case
          const conflictRes = await client.query(
            `SELECT 1 FROM ubicaciones WHERE codigo = $1 OR codigo_barra = $2`,
            [codigo, codigo_barra]
          );
          if (conflictRes.rows.length > 0) {
            existentes++;
            continue;
          }

          await client.query(
            `INSERT INTO ubicaciones (descripcion, sector_codigo, estanteria, nivel, posicion, codigo, codigo_barra) 
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [codigo, sector_codigo, e, n, p, codigo, codigo_barra]
          );
          generadas++;
        }
      }
    }

    revalidateTag("meta");
    return { generadas, existentes };
  });
}

// --------------------------------------------------------------------------------
// INTEGRACIÓN CON PRODUCTOS
// --------------------------------------------------------------------------------

export async function asignarUbicacionAProducto(producto_id: number | string, ubicacion_id: number | string): Promise<void> {
  return await withTransaction(async (client) => {
    const { rowCount } = await client.query(
      `UPDATE productos SET id_ubicacion = $1 WHERE id = $2`,
      [ubicacion_id, producto_id]
    );
    if (!rowCount) {
      throw new Error(`Producto con ID ${producto_id} no encontrado`);
    }
  });
}
