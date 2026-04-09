import { query, withTransaction, paginateQuery } from "@/lib/db-utils";
import { revalidateTag } from "next/cache";
import type { DbClient } from "@/lib/db-utils";
import type { Pieza, PiezaListado } from "@/interfaces/piezas";
import type { PiezaBusqueda } from "@/interfaces/productos";
import { sanitizeUppercaseString as sanitizeText, sanitizeCodes } from "@/utils/sanitization";
import { deleteFileFromStorage } from "@/lib/storage-cleanup";
export type ConflictRow = {
  codigo: string;
  codigo_pieza: number;
  tipo: string;
};

type PiezaInput = {
  descripcion: string;
  medida?: string | null;
  imagen_medida_url?: string | null;
  id_subcategoria: number;
  originales?: string[];
  equivalentes?: string[];
  sustitutos?: string[];
};


function sanitizePiezaInput(input: PiezaInput) {
  return {
    descripcion: sanitizeText(input.descripcion),
    medida: sanitizeText(input.medida) || null,
    imagenMedidaUrl: input.imagen_medida_url || null,
    idSubcategoria: Number(input.id_subcategoria),
    originales: sanitizeCodes(input.originales),
    equivalentes: sanitizeCodes(input.equivalentes),
    sustitutos: sanitizeCodes(input.sustitutos),
  };
}

function validatePiezaInput(payload: ReturnType<typeof sanitizePiezaInput>) {
  if (!payload.descripcion) throw new Error("La descripción es obligatoria");
  if (!Number.isInteger(payload.idSubcategoria) || payload.idSubcategoria <= 0) {
    throw new Error("La subcategoría es obligatoria");
  }
}

export async function findOrCreateCodigo(client: DbClient, codigo: string) {
  const codigoBuscado = sanitizeText(codigo);

  const existing = await client.query(
    `SELECT id FROM codigo_referencia WHERE UPPER(TRIM(codigo)) = $1 LIMIT 1`,
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
  tipo: "ORIGINAL" | "EQUIVALENTE" | "SUSTITUTO",
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
      ORDER BY p.codigo_pieza
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
  tipo: "ORIGINAL" | "EQUIVALENTE" | "SUSTITUTO",
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

async function replacePiezaCodigos(
  client: DbClient,
  pieceId: number | string,
  originales: string[],
  equivalentes: string[],
  sustitutos: string[]
) {
  await client.query(`DELETE FROM pieza_codigo_referencia WHERE id_pieza = $1`, [pieceId]);
  await attachCodigosToPieza(client, pieceId, "ORIGINAL", originales);
  await attachCodigosToPieza(client, pieceId, "EQUIVALENTE", equivalentes);
  await attachCodigosToPieza(client, pieceId, "SUSTITUTO", sustitutos);
}

async function cleanupOrphanedCodes(client: DbClient) {
  // Elimina códigos que ya no están referenciados por ninguna pieza
  await client.query(`
    DELETE FROM codigo_referencia 
    WHERE id NOT IN (SELECT id_codigo_referencia FROM pieza_codigo_referencia)
  `);
}

export async function getPiezasListado(page: number = 1, limit: number = 50): Promise<{ data: PiezaListado[]; totalCount: number; totalPages: number }> {
  const sql = `
    SELECT
      p.id,
      p.codigo_pieza,
      p.descripcion,
      p.medida,
      p.imagen_medida_url,
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
      COALESCE(
        ARRAY_AGG(DISTINCT cr.codigo) FILTER (WHERE pcr.tipo = 'SUSTITUTO' AND cr.codigo IS NOT NULL),
        ARRAY[]::varchar[]
      ) AS sustitutos,
      COUNT(DISTINCT cr.id) FILTER (WHERE pcr.tipo = 'ORIGINAL') AS cantidad_originales,
      COUNT(DISTINCT cr.id) FILTER (WHERE pcr.tipo = 'EQUIVALENTE') AS cantidad_equivalentes,
      COUNT(DISTINCT cr.id) FILTER (WHERE pcr.tipo = 'SUSTITUTO') AS cantidad_sustitutos
    FROM pieza p
    JOIN subcategoria s ON s.id = p.id_subcategoria
    JOIN categoria c ON c.id = s.id_categoria
    LEFT JOIN pieza_codigo_referencia pcr ON pcr.id_pieza = p.id
    LEFT JOIN codigo_referencia cr ON cr.id = pcr.id_codigo_referencia
    GROUP BY p.id, p.codigo_pieza, p.descripcion, p.medida, p.imagen_medida_url, p.id_subcategoria, s.descripcion, c.descripcion
    ORDER BY p.codigo_pieza ASC
  `;

  return await paginateQuery<PiezaListado>("pieza", sql, page, limit);
}

export async function getPiezasBusqueda(): Promise<PiezaBusqueda[]> {
  const sql = `
    SELECT
      p.id,
      p.codigo_pieza,
      p.descripcion,
      p.medida,
      p.imagen_medida_url,
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
      ) AS equivalentes,
      COALESCE(
        ARRAY_AGG(DISTINCT cr.codigo) FILTER (WHERE pcr.tipo = 'SUSTITUTO' AND cr.codigo IS NOT NULL),
        ARRAY[]::varchar[]
      ) AS sustitutos
    FROM pieza p
    JOIN subcategoria s ON s.id = p.id_subcategoria
    JOIN categoria c ON c.id = s.id_categoria
    LEFT JOIN pieza_codigo_referencia pcr ON pcr.id_pieza = p.id
    LEFT JOIN codigo_referencia cr ON cr.id = pcr.id_codigo_referencia
    GROUP BY p.id, p.codigo_pieza, p.descripcion, p.medida, p.imagen_medida_url, c.id, c.descripcion, s.id, s.descripcion
    ORDER BY p.codigo_pieza ASC
  `;
  const { rows } = await query(sql);

  return rows as PiezaBusqueda[];
}

export async function getNextCodigoPieza(): Promise<number> {
  const { rows } = await query(`
    SELECT COALESCE(MAX(codigo_pieza), 0) + 1 as next 
    FROM pieza
  `);
  return Number(rows[0].next);
}


export async function getPiezaById(id: string | number): Promise<Pieza | null> {
  const piezaQuery = `
    SELECT p.id, p.codigo_pieza, p.descripcion, p.medida, p.imagen_medida_url, p.id_subcategoria, s.id_categoria
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
    query(piezaQuery, [id]),
    query(codigosQuery, [id]),
  ]);

  if (piezaRes.rows.length === 0) return null;

  const pieza = piezaRes.rows[0];
  const codigos = codigosRes.rows as { codigo: string; tipo: string }[];

  return {
    ...pieza,
    originales: codigos.filter((row) => row.tipo === "ORIGINAL").map((row) => row.codigo),
    equivalentes: codigos.filter((row) => row.tipo === "EQUIVALENTE").map((row) => row.codigo),
    sustitutos: codigos.filter((row) => row.tipo === "SUSTITUTO").map((row) => row.codigo),
  } as Pieza;
}

export async function createPieza(input: PiezaInput) {
  return await withTransaction(async (client) => {
    const payload = sanitizePiezaInput(input);
    validatePiezaInput(payload);

    const originalConflicts = await findCodeConflicts(client, payload.originales, "ORIGINAL");
    if (originalConflicts.length > 0) {
      const err = new Error(
        buildConflictMessage("Estos números originales ya existen en otras piezas", originalConflicts)
      );
      (err as Error & { status?: number }).status = 409;
      throw err;
    }

    const equivalenteConflicts = await findCodeConflicts(client, payload.equivalentes, "EQUIVALENTE");

    const piezaResult = await client.query(
      `
        INSERT INTO pieza (descripcion, medida, imagen_medida_url, id_subcategoria)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `,
      [payload.descripcion, payload.medida, payload.imagenMedidaUrl, payload.idSubcategoria]
    );

    const pieza = piezaResult.rows[0];
    await attachCodigosToPieza(client, pieza.id, "ORIGINAL", payload.originales);
    await attachCodigosToPieza(client, pieza.id, "EQUIVALENTE", payload.equivalentes);
    await attachCodigosToPieza(client, pieza.id, "SUSTITUTO", payload.sustitutos);

    revalidateTag("meta");

    return {
      pieza,
      warning: equivalenteConflicts.length > 0 ? buildWarningMessage(equivalenteConflicts) : null,
    };
  });
}

export async function updatePieza(id: string | number, input: PiezaInput) {
  // Obtenemos la pieza ANTES para saber si la imagen cambió
  const existingPieza = await getPiezaById(id);
  const oldImageUrl = existingPieza?.imagen_medida_url;

  const result = await withTransaction(async (client) => {
    const numericId = Number(id);
    const payload = sanitizePiezaInput(input);
    validatePiezaInput(payload);

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
            imagen_medida_url = $3,
            id_subcategoria = $4,
            updated_at = now()
        WHERE id = $5
        RETURNING *
      `,
      [payload.descripcion, payload.medida, payload.imagenMedidaUrl, payload.idSubcategoria, id]
    );

    if ((updateResult.rowCount ?? 0) === 0) {
      const err = new Error("Pieza no encontrada");
      (err as Error & { status?: number }).status = 404;
      throw err;
    }

    await replacePiezaCodigos(client, id, payload.originales, payload.equivalentes, payload.sustitutos);
    
    // Limpieza de códigos huérfanos
    await cleanupOrphanedCodes(client);

    revalidateTag("meta");

    return {
      pieza: updateResult.rows[0],
      warning: equivalenteConflicts.length > 0 ? buildWarningMessage(equivalenteConflicts) : null,
    };
  });

  // Si la transacción fue exitosa y la imagen cambió, borramos la vieja
  const newImageUrl = input.imagen_medida_url;
  if (oldImageUrl && oldImageUrl !== newImageUrl) {
    // No usamos await aquí para no retrasar la respuesta, pero lo llamamos
    deleteFileFromStorage(oldImageUrl, "piezas");
  }

  return result;
}

export async function deletePieza(id: string | number) {
  const usage = await query(`SELECT 1 FROM productos WHERE id_pieza = $1 LIMIT 1`, [id]);
  if (usage.rows[0]) {
    const err = new Error("No se puede eliminar la pieza porque está asociada a productos");
    (err as Error & { status?: number }).status = 409;
    throw err;
  }

  const piezaToDelete = await getPiezaById(id);

  const deleteResult = await withTransaction(async (client) => {
    await client.query(`DELETE FROM pieza_codigo_referencia WHERE id_pieza = $1`, [id]);
    const result = await client.query(`DELETE FROM pieza WHERE id = $1`, [id]);
    
    // Limpieza de códigos huérfanos
    await cleanupOrphanedCodes(client);

    revalidateTag("meta");
    
    return { deleted: (result.rowCount ?? 0) > 0 };
  });

  // Limpieza de almacenamiento si se borró con éxito de la DB
  if (deleteResult.deleted && piezaToDelete?.imagen_medida_url) {
    deleteFileFromStorage(piezaToDelete.imagen_medida_url, "piezas");
  }

  return deleteResult;
}
