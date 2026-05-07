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

export interface UbicacionesPaginadasParams {
  page?: number;
  pageSize?: number;
  search?: string;
  onlyLegacy?: boolean;
}

export interface UbicacionesPaginadasResult {
  data: Ubicacion[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

export async function listarUbicacionesPaginadas(params: UbicacionesPaginadasParams): Promise<UbicacionesPaginadasResult> {
  const page = Math.max(1, params.page || 1);
  const pageSize = params.pageSize || 25;
  const search = params.search?.trim() || "";

  const whereParts: string[] = [];
  const queryParams: any[] = [];
  
  if (search) {
    const cleanedSearch = search.toUpperCase();
    let q = cleanedSearch;
    if (q.startsWith("UBI:")) {
      q = q.substring(4);
    }
    queryParams.push(`%${q}%`);
    whereParts.push(`(
      UPPER(codigo) LIKE $${queryParams.length} OR 
      UPPER(codigo_barra) LIKE $${queryParams.length} OR 
      UPPER(descripcion) LIKE $${queryParams.length} OR
      UPPER(sector_codigo) LIKE $${queryParams.length}
    )`);
  }

  if (params.onlyLegacy) {
    whereParts.push(`(codigo_barra IS NULL OR codigo_barra = '')`);
  }

  const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

  const countQuery = `SELECT COUNT(*)::int AS total FROM ubicaciones ${whereClause}`;
  const countResult = await query(countQuery, queryParams);
  const totalCount = countResult.rows[0]?.total || 0;
  
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  
  // Ajustar la página si excede el total
  const currentPage = Math.min(page, totalPages);
  const offset = (currentPage - 1) * pageSize;

  // Add order by, limit and offset parameters
  const selectQuery = `
    SELECT * FROM ubicaciones 
    ${whereClause} 
    ORDER BY ${getOrderByClause()} 
    LIMIT $${queryParams.length + 1} 
    OFFSET $${queryParams.length + 2}
  `;
  
  const finalParams = [...queryParams, pageSize, offset];
  const { rows } = await query(selectQuery, finalParams);

  return {
    data: rows as Ubicacion[],
    totalCount,
    totalPages,
    currentPage,
    pageSize
  };
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

/**
 * Detects candidate structured location codes within a free-text description.
 * Returns an array of parsed candidates with sector, est, niv, pos.
 * Examples:
 *   "D8-4-1 D10-11-1" → [{sector:"D",est:8,niv:4,pos:1}, {sector:"D",est:10,niv:11,pos:1}]
 *   "TALLER-4-1"      → [] (multi-char sector is not auto-convertible)
 *   "D55-4"           → [] (incomplete — only 2 parts)
 */
export interface UbicacionCandidate {
  raw: string;
  sector: string;
  estanteria: number;
  nivel: number;
  posicion: number;
  codigo: string;
  completo: boolean;
}

export function detectarCodigosEnTexto(texto: string): UbicacionCandidate[] {
  if (!texto) return [];
  // Match patterns like C4-5-3 or D10-11-1 (single letter + digits-digits-digits)
  const regex = /\b([A-Za-z])(\d+)-(\d+)-(\d+)\b/g;
  const candidates: UbicacionCandidate[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(texto)) !== null) {
    const sector = match[1].toUpperCase();
    const est = parseInt(match[2], 10);
    const niv = parseInt(match[3], 10);
    const pos = parseInt(match[4], 10);
    if (est >= 0 && niv >= 0 && pos >= 0) {
      candidates.push({
        raw: match[0],
        sector,
        estanteria: est,
        nivel: niv,
        posicion: pos,
        codigo: `${sector}${est}-${niv}-${pos}`,
        completo: true,
      });
    }
  }

  return candidates;
}

/**
 * Checks whether a given canonical code is already taken by another ubicacion.
 * Returns true if the code is available (safe to use).
 */
export async function validarCodigoDisponible(
  codigo: string,
  excludeId?: number | string
): Promise<boolean> {
  const codigoBarra = `UBI:${codigo}`;
  const params: any[] = [codigo, codigoBarra];
  let excludeClause = "";
  if (excludeId !== undefined) {
    params.push(excludeId);
    excludeClause = ` AND id <> $3`;
  }
  const { rows } = await query(
    `SELECT 1 FROM ubicaciones WHERE (codigo = $1 OR codigo_barra = $2)${excludeClause} LIMIT 1`,
    params
  );
  return rows.length === 0;
}

export interface ActualizarUbicacionData {
  descripcion?: string;
  sector_codigo?: string | null;
  estanteria?: number | null;
  nivel?: number | null;
  posicion?: number | null;
  observaciones?: string | null;
}

/**
 * Updates an existing ubicacion by id.
 * - If all structural fields are provided, the DB trigger will derive codigo & codigo_barra.
 * - Validates sector exists and canonical code is not duplicated.
 * - Never changes the id.
 */
export async function actualizarUbicacionEstructurada(
  id: number | string,
  data: ActualizarUbicacionData
): Promise<Ubicacion> {
  return await withTransaction(async (client) => {
    const isStructural = data.sector_codigo && data.estanteria != null && data.nivel != null && data.posicion != null;

    if (isStructural) {
      // Validate sector exists
      const sectorRes = await client.query(
        `SELECT codigo FROM ubicacion_sector WHERE codigo = $1`,
        [data.sector_codigo]
      );
      if (sectorRes.rows.length === 0) {
        throw new Error(`El sector "${data.sector_codigo}" no existe.`);
      }

      // Validate no duplicate code (the trigger will generate the code)
      const futureCodigo = `${data.sector_codigo}${data.estanteria}-${data.nivel}-${data.posicion}`;
      const duplicateRes = await client.query(
        `SELECT id FROM ubicaciones WHERE codigo = $1 AND id <> $2 LIMIT 1`,
        [futureCodigo, id]
      );
      if (duplicateRes.rows.length > 0) {
        throw new Error(`Ya existe la ubicación ${futureCodigo}`);
      }
    }

    // Build dynamic SET clause
    const sets: string[] = [];
    const params: any[] = [];
    let paramIdx = 0;

    const addField = (col: string, val: any) => {
      paramIdx++;
      sets.push(`${col} = $${paramIdx}`);
      params.push(val);
    };

    if (data.descripcion !== undefined) addField("descripcion", data.descripcion);
    if (data.sector_codigo !== undefined) addField("sector_codigo", data.sector_codigo);
    if (data.estanteria !== undefined) addField("estanteria", data.estanteria);
    if (data.nivel !== undefined) addField("nivel", data.nivel);
    if (data.posicion !== undefined) addField("posicion", data.posicion);
    if (data.observaciones !== undefined) addField("observaciones", data.observaciones);

    addField("updated_at", new Date());

    if (sets.length === 1) {
      // Only updated_at — nothing meaningful to change
      throw new Error("No se proporcionaron campos para actualizar");
    }

    paramIdx++;
    params.push(id);

    const { rows, rowCount } = await client.query(
      `UPDATE ubicaciones SET ${sets.join(", ")} WHERE id = $${paramIdx} RETURNING *`,
      params
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

/** Legacy compat wrapper — delegates to actualizarUbicacionEstructurada */
export async function updateLegacyUbicacion(
  id: number | string,
  sector_codigo: string,
  estanteria: number,
  nivel: number,
  posicion: number
): Promise<Ubicacion> {
  return actualizarUbicacionEstructurada(id, { sector_codigo, estanteria, nivel, posicion });
}

export async function buscarUbicacionPorCodigo(codigo: string): Promise<Ubicacion | null> {
  const { rows } = await query(`SELECT * FROM ubicaciones WHERE codigo = $1 LIMIT 1`, [codigo]);
  return rows.length > 0 ? (rows[0] as Ubicacion) : null;
}

export async function buscarUbicacionPorBarcode(codigo_barra: string): Promise<Ubicacion | null> {
  const { rows } = await query(`SELECT * FROM ubicaciones WHERE codigo_barra = $1 LIMIT 1`, [codigo_barra]);
  return rows.length > 0 ? (rows[0] as Ubicacion) : null;
}

export function normalizarCodigoEscaneado(valor: string): string {
  let cleaned = valor.trim().toUpperCase();
  if (cleaned.startsWith("UBI:")) {
    cleaned = cleaned.substring(4);
  }
  return cleaned;
}

export async function buscarUbicacionPorCodigoEscaneado(valor: string): Promise<Ubicacion | null> {
  if (!valor) return null;
  const codigo = normalizarCodigoEscaneado(valor);
  const codigoBarra = `UBI:${codigo}`;
  
  const { rows } = await query(
    `SELECT * FROM ubicaciones WHERE codigo = $1 OR codigo_barra = $2 OR UPPER(descripcion) = $1 LIMIT 1`,
    [codigo, codigoBarra]
  );
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

export async function asignarUbicacionAProductosMasivo(productoIds: number[], ubicacionId: number): Promise<number> {
  return await withTransaction(async (client) => {
    if (!productoIds.length) throw new Error("No hay productos seleccionados");

    const ubicacionRes = await client.query(`SELECT 1 FROM ubicaciones WHERE id = $1`, [ubicacionId]);
    if (ubicacionRes.rows.length === 0) throw new Error("La ubicación destino no existe");

    const { rowCount } = await client.query(
      `UPDATE productos SET id_ubicacion = $1 WHERE id = ANY($2::bigint[])`,
      [ubicacionId, productoIds]
    );
    return rowCount || 0;
  });
}

