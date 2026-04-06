import { pool } from "@/utils/database";
import type { PoolClient } from "pg";
import type { Pieza, PiezaListado } from "@/interfaces/piezas";
import type { PiezaBusqueda } from "@/interfaces/productos";

export type DbClient = Pick<PoolClient, "query">;
export type ConflictRow = {
  codigo: string;
  codigo_pieza: number;
  tipo: string;
};

type PiezaInput = {
  codigo_pieza?: number | null;
  descripcion: string;
  medida?: string;
  id_subcategoria: number;
  originales?: string[];
  equivalentes?: string[];
};

export function sanitizeCodigoPieza(value: unknown) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;

  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 1000) {
    throw new Error("El código de pieza debe ser un número válido");
  }

  return parsed;
}

function sanitizeText(value: unknown) {
  return String(value ?? "").toUpperCase().trim();
}

export function sanitizeCodes(values: unknown): string[] {
  if (!Array.isArray(values)) return [];

  return Array.from(
    new Set(
      values
        .map((item) => sanitizeText(item))
        .filter(Boolean)
    )
  );
}

function sanitizePiezaInput(input: PiezaInput) {
  return {
    codigoPieza: sanitizeCodigoPieza(input.codigo_pieza),
    descripcion: sanitizeText(input.descripcion),
    medida: sanitizeText(input.medida),
    idSubcategoria: Number(input.id_subcategoria),
    originales: sanitizeCodes(input.originales),
    equivalentes: sanitizeCodes(input.equivalentes),
  };
}

function validatePiezaInput(payload: ReturnType<typeof sanitizePiezaInput>) {
  if (!payload.descripcion) throw new Error("La descripción es obligatoria");
  if (!Number.isInteger(payload.idSubcategoria) || payload.idSubcategoria <= 0) {
    throw new Error("La subcategoría es obligatoria");
  }
}

export async function getNextCodigoPieza(): Promise<number> {
  const { rows } = await pool.query(`
    SELECT COALESCE(MAX(codigo_pieza), 999) + 1 AS next_codigo
    FROM pieza
  `);
  return Number(rows[0]?.next_codigo ?? 1000);
}

export async function findOrCreateCodigo(client: DbClient, codigo: string) {
  const codigoBuscado = sanitizeText(codigo);

  const existing = await client.query(
    `SELECT id FROM codigo_referencia WHERE codigo = $1 LIMIT 1`,
    [codigoBuscado]
  );

  if (existing.rows[0]) return existing.rows[0].id as number;

  const inserted = await client.query(
    `
      INSERT INTO codigo_referencia (codigo)
      VALUES ($1)
      RETURNING id
    `,
    [codigoBuscado]
  );

  return inserted.rows[0].id as number;
}

export async function findCodeConflicts(
  client: DbClient,
  codes: string[],
  tipo: "ORIGINAL" | "EQUIVALENTE",
  excludePieceId?: number
): Promise<ConflictRow[]> {
  if (codes.length === 0) return [];

  const params: (string[] | string | number)[] = [codes.map((code) => sanitizeText(code)), tipo];
  let excludeSql = "";
  if (excludePieceId) {
    excludeSql = "AND p.id <> $3";
    params.push(excludePieceId);
  }

  const result = await client.query(
    `
      SELECT DISTINCT cr.codigo, p.codigo_pieza, pcr.tipo
      FROM pieza_codigo_referencia pcr
      JOIN codigo_referencia cr ON cr.id = pcr.id_codigo_referencia
      JOIN pieza p ON p.id = pcr.id_pieza
      WHERE UPPER(TRIM(cr.codigo)) = ANY($1)
        AND pcr.tipo = $2
        ${excludeSql}
      ORDER BY codigo_pieza
    `,
    params
  );

  return result.rows as ConflictRow[];
}

export function buildConflictMessage(prefix: string, conflicts: ConflictRow[]) {
  const unique = Array.from(
    new Map(conflicts.map((item) => [`${item.codigo}@@${item.codigo_pieza}`, item])).values()
  );

  return `${prefix}: ${unique
    .map((item) => `${item.codigo} (pieza ${item.codigo_pieza})`)
    .join(", ")}`;
}

export function buildWarningMessage(conflicts: ConflictRow[]) {
  const unique = Array.from(
    new Map(conflicts.map((item) => [`${item.codigo}@@${item.codigo_pieza}`, item])).values()
  );

  return `Atención: estas equivalencias ya existen en otras piezas: ${unique
    .map((item) => `${item.codigo} (pieza ${item.codigo_pieza})`)
    .join(", ")}`;
}

async function attachCodigosToPieza(
  client: DbClient,
  pieceId: number | string,
  tipo: "ORIGINAL" | "EQUIVALENTE",
  codigos: string[]
) {
  for (const codigo of codigos) {
    const idCodigo = await findOrCreateCodigo(client, codigo);
    await client.query(
      `
        INSERT INTO pieza_codigo_referencia (id_pieza, id_codigo_referencia, tipo)
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING
      `,
      [pieceId, idCodigo, tipo]
    );
  }
}

async function cleanupUnusedCodigos(client: DbClient) {
  await client.query(`
    DELETE FROM codigo_referencia cr
    WHERE NOT EXISTS (
      SELECT 1
      FROM pieza_codigo_referencia pcr
      WHERE pcr.id_codigo_referencia = cr.id
    )
  `);
}

async function replacePiezaCodigos(
  client: DbClient,
  pieceId: number | string,
  originales: string[],
  equivalentes: string[]
) {
  await client.query(`DELETE FROM pieza_codigo_referencia WHERE id_pieza = $1`, [pieceId]);
  await attachCodigosToPieza(client, pieceId, "ORIGINAL", originales);
  await attachCodigosToPieza(client, pieceId, "EQUIVALENTE", equivalentes);
  await cleanupUnusedCodigos(client);
}

export async function getPiezasListado(): Promise<PiezaListado[]> {
  const { rows } = await pool.query(`
    SELECT
      p.id,
      p.codigo_pieza,
      p.descripcion,
      COALESCE(p.medida, '') AS medida,
      p.id_subcategoria,
      s.descripcion AS subcategoria,
      c.descripcion AS categoria,
      COALESCE(
        ARRAY_AGG(DISTINCT cr.codigo) FILTER (WHERE pcr.tipo = 'ORIGINAL' AND cr.codigo IS NOT NULL),
        ARRAY[]::varchar[]
      ) AS originales,
      COALESCE(
        ARRAY_AGG(DISTINCT cr.codigo) FILTER (WHERE pcr.tipo = 'EQUIVALENTE' AND cr.codigo IS NOT NULL),
        ARRAY[]::varchar[]
      ) AS equivalentes,
      COUNT(DISTINCT cr.id) FILTER (WHERE pcr.tipo = 'ORIGINAL') AS cantidad_originales,
      COUNT(DISTINCT cr.id) FILTER (WHERE pcr.tipo = 'EQUIVALENTE') AS cantidad_equivalentes
    FROM pieza p
    JOIN subcategoria s ON s.id = p.id_subcategoria
    JOIN categoria c ON c.id = s.id_categoria
    LEFT JOIN pieza_codigo_referencia pcr ON pcr.id_pieza = p.id
    LEFT JOIN codigo_referencia cr ON cr.id = pcr.id_codigo_referencia
    GROUP BY p.id, p.codigo_pieza, p.descripcion, p.medida, p.id_subcategoria, s.descripcion, c.descripcion
    ORDER BY codigo_pieza ASC
  `);

  return rows as PiezaListado[];
}



export async function getPiezasBusqueda(): Promise<PiezaBusqueda[]> {
  const { rows } = await pool.query(`
    SELECT
      p.id,
      p.codigo_pieza,
      p.descripcion,
      COALESCE(p.medida, '') AS medida,
      c.id AS id_categoria,
      c.descripcion AS categoria,
      s.id AS id_subcategoria,
      s.descripcion AS subcategoria,
      COALESCE(
        ARRAY_AGG(DISTINCT cr.codigo) FILTER (WHERE pcr.tipo = 'ORIGINAL' AND cr.codigo IS NOT NULL),
        ARRAY[]::varchar[]
      ) AS originales,
      COALESCE(
        ARRAY_AGG(DISTINCT cr.codigo) FILTER (WHERE pcr.tipo = 'EQUIVALENTE' AND cr.codigo IS NOT NULL),
        ARRAY[]::varchar[]
      ) AS equivalentes
    FROM pieza p
    JOIN subcategoria s ON s.id = p.id_subcategoria
    JOIN categoria c ON c.id = s.id_categoria
    LEFT JOIN pieza_codigo_referencia pcr ON pcr.id_pieza = p.id
    LEFT JOIN codigo_referencia cr ON cr.id = pcr.id_codigo_referencia
    GROUP BY p.id, p.codigo_pieza, p.descripcion, p.medida, c.id, c.descripcion, s.id, s.descripcion
    ORDER BY codigo_pieza ASC
  `);

  return rows as PiezaBusqueda[];
}

export async function getPiezaById(id: string | number): Promise<Pieza | null> {
  const piezaQuery = `
    SELECT p.id, p.codigo_pieza, p.descripcion, COALESCE(p.medida, '') AS medida, p.id_subcategoria, s.id_categoria
    FROM pieza p
    JOIN subcategoria s ON s.id = p.id_subcategoria
    WHERE p.id = $1
  `;

  const codigosQuery = `
    SELECT cr.codigo, pcr.tipo
    FROM pieza_codigo_referencia pcr
    JOIN codigo_referencia cr ON cr.id = pcr.id_codigo_referencia
    WHERE pcr.id_pieza = $1
    ORDER BY pcr.tipo, cr.codigo
  `;

  const [piezaRes, codigosRes] = await Promise.all([
    pool.query(piezaQuery, [id]),
    pool.query(codigosQuery, [id]),
  ]);

  if (piezaRes.rows.length === 0) return null;

  const pieza = piezaRes.rows[0];
  return {
    ...pieza,
    originales: (codigosRes.rows as { codigo: string; tipo: string }[])
      .filter((row) => row.tipo === "ORIGINAL")
      .map((row) => row.codigo),
    equivalentes: (codigosRes.rows as { codigo: string; tipo: string }[])
      .filter((row) => row.tipo === "EQUIVALENTE")
      .map((row) => row.codigo),
  } as Pieza;
}

export async function createPieza(input: PiezaInput) {
  const client = await pool.connect();
  try {
    const payload = sanitizePiezaInput(input);
    validatePiezaInput(payload);

    await client.query("BEGIN");

    if (payload.codigoPieza !== null) {
      const duplicate = await client.query(
        `SELECT id FROM pieza WHERE codigo_pieza = $1 LIMIT 1`,
        [payload.codigoPieza]
      );
      if (duplicate.rows[0]) {
        const err = new Error("Ya existe una pieza con ese código");
        (err as Error & { status?: number }).status = 409;
        throw err;
      }
    }

    const originalConflicts = await findCodeConflicts(client, payload.originales, "ORIGINAL");
    if (originalConflicts.length > 0) {
      const err = new Error(
        buildConflictMessage("Estos números originales ya existen en otras piezas", originalConflicts)
      );
      (err as Error & { status?: number }).status = 409;
      throw err;
    }

    const equivalenteConflicts = await findCodeConflicts(client, payload.equivalentes, "EQUIVALENTE");

    const piezaResult = payload.codigoPieza !== null
      ? await client.query(
          `
            INSERT INTO pieza (codigo_pieza, descripcion, medida, id_subcategoria)
            VALUES ($1, $2, $3, $4)
            RETURNING *
          `,
          [payload.codigoPieza, payload.descripcion, payload.medida || null, payload.idSubcategoria]
        )
      : await client.query(
          `
            INSERT INTO pieza (descripcion, medida, id_subcategoria)
            VALUES ($1, $2, $3)
            RETURNING *
          `,
          [payload.descripcion, payload.medida || null, payload.idSubcategoria]
        );

    const pieza = piezaResult.rows[0];
    await attachCodigosToPieza(client, pieza.id, "ORIGINAL", payload.originales);
    await attachCodigosToPieza(client, pieza.id, "EQUIVALENTE", payload.equivalentes);

    await client.query("COMMIT");
    return {
      pieza,
      warning: equivalenteConflicts.length > 0 ? buildWarningMessage(equivalenteConflicts) : null,
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    throw error;
  } finally {
    client.release();
  }
}

export async function updatePieza(id: string | number, input: PiezaInput) {
  const client = await pool.connect();
  try {
    const numericId = Number(id);
    const payload = sanitizePiezaInput(input);
    validatePiezaInput(payload);

    await client.query("BEGIN");


    const originalConflicts = await findCodeConflicts(client, payload.originales, "ORIGINAL", numericId);
    if (originalConflicts.length > 0) {
      const err = new Error(
        buildConflictMessage("Estos números originales ya existen en otras piezas", originalConflicts)
      );
      (err as Error & { status?: number }).status = 409;
      throw err;
    }

    const equivalenteConflicts = await findCodeConflicts(client, payload.equivalentes, "EQUIVALENTE", numericId);

    const updateResult = await client.query(
      `
        UPDATE pieza
        SET descripcion = $1,
            medida = $2,
            id_subcategoria = $3
        WHERE id = $4
        RETURNING *
      `,
      [payload.descripcion, payload.medida || null, payload.idSubcategoria, id]
    );

    if ((updateResult.rowCount ?? 0) === 0) {
      const err = new Error("Pieza no encontrada");
      (err as Error & { status?: number }).status = 404;
      throw err;
    }

    await replacePiezaCodigos(client, id, payload.originales, payload.equivalentes);

    await client.query("COMMIT");
    return {
      pieza: updateResult.rows[0],
      warning: equivalenteConflicts.length > 0 ? buildWarningMessage(equivalenteConflicts) : null,
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    throw error;
  } finally {
    client.release();
  }
}

export async function deletePieza(id: string | number) {
  const usage = await pool.query(`SELECT 1 FROM productos WHERE id_pieza = $1 LIMIT 1`, [id]);
  if (usage.rows[0]) {
    const err = new Error("No se puede eliminar la pieza porque está asociada a productos");
    (err as Error & { status?: number }).status = 409;
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM pieza_codigo_referencia WHERE id_pieza = $1`, [id]);
    await cleanupUnusedCodigos(client);
    const result = await client.query(`DELETE FROM pieza WHERE id = $1`, [id]);
    await client.query("COMMIT");
    return { deleted: (result.rowCount ?? 0) > 0 };
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    throw error;
  } finally {
    client.release();
  }
}
