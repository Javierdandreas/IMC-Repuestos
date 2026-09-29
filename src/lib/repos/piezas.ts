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

type PiezaImportMapping = Record<string, { csvHeader?: string }>;

type PiezaImportRow = {
  row: number;
  codigoPieza: number;
  descripcion: string;
  categoria: string;
  subcategoria: string;
  medida: string | null;
  originales: string[];
  equivalentes: string[];
  sustitutos: string[];
};

export type PiezaImportResult = {
  created: number;
  updated: number;
  ignored: number;
  categoriesCreated: string[];
  subcategoriesCreated: string[];
  errors: Array<{ row: number; error: string; codigo_pieza: string }>;
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
    .map((item) => `${item.codigo} (item asociado ${item.codigo_pieza})`)
    .join(", ")}`;
}

export function buildWarningMessage(conflicts: ConflictRow[]) {
  const unique = Array.from(
    new Map(conflicts.map((item) => [`${item.codigo}@@${item.codigo_pieza}`, item])).values()
  );

  return `Atención: estas equivalencias ya existen en otros items asociados: ${unique
    .map((item) => `${item.codigo} (item asociado ${item.codigo_pieza})`)
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

export async function getPiezasParaExportar(): Promise<Record<string, string | number | null>[]> {
  const { rows } = await query<{
    codigo_pieza: number;
    descripcion: string;
    categoria: string | null;
    subcategoria: string | null;
    medida: string | null;
    originales: string[];
    equivalentes: string[];
    sustitutos: string[];
  }>(`
    SELECT
      p.codigo_pieza,
      p.descripcion,
      c.descripcion AS categoria,
      s.descripcion AS subcategoria,
      p.medida,
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
    FROM public.pieza p
    JOIN public.subcategoria s ON s.id = p.id_subcategoria
    JOIN public.categoria c ON c.id = s.id_categoria
    LEFT JOIN public.pieza_codigo_referencia pcr ON pcr.id_pieza = p.id
    LEFT JOIN public.codigo_referencia cr ON cr.id = pcr.id_codigo_referencia
    GROUP BY p.id, p.codigo_pieza, p.descripcion, c.descripcion, s.descripcion, p.medida
    ORDER BY p.codigo_pieza ASC
  `);

  const joinCodes = (codes: string[]) => codes.join("; ");

  return rows.map((row) => ({
    "Codigo Item Asociado": row.codigo_pieza,
    Descripcion: row.descripcion,
    Categoria: row.categoria,
    Subcategoria: row.subcategoria,
    Medida: row.medida,
    "Codigos Originales": joinCodes(row.originales),
    "Codigos Equivalentes": joinCodes(row.equivalentes),
    "Codigos Sustitutos": joinCodes(row.sustitutos),
  }));
}

function normalizePiezaImportValue(value: unknown) {
  return sanitizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function splitImportedCodes(value: unknown) {
  return sanitizeCodes(String(value ?? "").split(/[;,|\r\n]+/));
}

export async function importPiezas(items: unknown[], mappings: PiezaImportMapping): Promise<PiezaImportResult> {
  const results: PiezaImportResult = {
    created: 0,
    updated: 0,
    ignored: 0,
    categoriesCreated: [],
    subcategoriesCreated: [],
    errors: [],
  };

  const requiredFields = [
    "codigo_pieza",
    "descripcion",
    "categoria",
    "subcategoria",
    "originales",
    "equivalentes",
    "sustitutos",
  ];

  const missingMappings = requiredFields.filter((field) => !mappings[field]?.csvHeader);
  if (missingMappings.length > 0) {
    throw new Error(`Falta mapear: ${missingMappings.join(", ")}`);
  }

  const headerFor = (field: string) => mappings[field]?.csvHeader ?? "";
  const read = (item: Record<string, unknown>, field: string) => item[headerFor(field)];
  const invalidRows = new Set<number>();
  const addError = (row: number, error: string, codigoPieza: string) => {
    if (!invalidRows.has(row)) {
      invalidRows.add(row);
      results.ignored += 1;
    }
    results.errors.push({ row, error, codigo_pieza: codigoPieza });
  };

  const rows: PiezaImportRow[] = [];
  const firstRowByCode = new Map<number, number>();

  items.forEach((rawItem, index) => {
    const row = index + 2;
    const item = rawItem && typeof rawItem === "object" ? rawItem as Record<string, unknown> : {};
    const rawCode = String(read(item, "codigo_pieza") ?? "").trim();
    const codigoPieza = Number(rawCode);

    if (!Number.isInteger(codigoPieza) || codigoPieza <= 0) {
      addError(row, "Codigo de item asociado invalido", rawCode || "?");
      return;
    }

    const descripcion = sanitizeText(read(item, "descripcion"));
    const categoria = sanitizeText(read(item, "categoria"));
    const subcategoria = sanitizeText(read(item, "subcategoria"));
    if (!descripcion || !categoria || !subcategoria) {
      addError(row, "Descripcion, categoria y subcategoria son obligatorias", String(codigoPieza));
      return;
    }

    const existingRow = firstRowByCode.get(codigoPieza);
    if (existingRow) {
      addError(row, `Codigo de item asociado repetido (tambien esta en la fila ${existingRow})`, String(codigoPieza));
      return;
    }
    firstRowByCode.set(codigoPieza, row);

    rows.push({
      row,
      codigoPieza,
      descripcion,
      categoria,
      subcategoria,
      medida: sanitizeText(read(item, "medida")) || null,
      originales: splitImportedCodes(read(item, "originales")),
      equivalentes: splitImportedCodes(read(item, "equivalentes")),
      sustitutos: splitImportedCodes(read(item, "sustitutos")),
    });
  });

  if (rows.length === 0) return results;

  return await withTransaction(async (client) => {
    const incomingOriginals = new Map<string, PiezaImportRow>();
    rows.forEach((row) => {
      row.originales.forEach((codigo) => {
        const normalizedCode = normalizePiezaImportValue(codigo);
        const owner = incomingOriginals.get(normalizedCode);
        if (owner && owner.codigoPieza !== row.codigoPieza) {
          addError(row.row, `El numero original ${codigo} tambien figura en el item asociado ${owner.codigoPieza}`, String(row.codigoPieza));
          return;
        }
        incomingOriginals.set(normalizedCode, row);
      });
    });

    const importedOriginals = Array.from(incomingOriginals.keys());
    if (importedOriginals.length > 0) {
      const { rows: existingOriginals } = await client.query<{ codigo: string; codigo_pieza: number }>(`
        SELECT UPPER(TRIM(cr.codigo)) AS codigo, p.codigo_pieza
        FROM public.pieza_codigo_referencia pcr
        JOIN public.codigo_referencia cr ON cr.id = pcr.id_codigo_referencia
        JOIN public.pieza p ON p.id = pcr.id_pieza
        WHERE pcr.tipo = 'ORIGINAL'
          AND UPPER(TRIM(cr.codigo)) = ANY($1::text[])
      `, [importedOriginals]);

      const existingByCode = new Map<string, number[]>();
      existingOriginals.forEach((item) => {
        const codes = existingByCode.get(item.codigo) ?? [];
        codes.push(Number(item.codigo_pieza));
        existingByCode.set(item.codigo, codes);
      });

      rows.forEach((row) => {
        row.originales.forEach((codigo) => {
          const conflict = (existingByCode.get(normalizePiezaImportValue(codigo)) ?? [])
            .find((pieceCode) => pieceCode !== row.codigoPieza);
          if (conflict) {
            addError(row.row, `El numero original ${codigo} ya pertenece al item asociado ${conflict}`, String(row.codigoPieza));
          }
        });
      });
    }

    const validRows = rows.filter((row) => !invalidRows.has(row.row));
    if (validRows.length === 0) return results;

    const [categoryResult, subcategoryResult] = await Promise.all([
      client.query<{ id: number; descripcion: string }>("SELECT id, descripcion FROM public.categoria"),
      client.query<{ id: number; id_categoria: number; descripcion: string }>("SELECT id, id_categoria, descripcion FROM public.subcategoria"),
    ]);

    const categoryIds = new Map(
      categoryResult.rows.map((category) => [normalizePiezaImportValue(category.descripcion), Number(category.id)])
    );
    const subcategoryIds = new Map(
      subcategoryResult.rows.map((subcategory) => [
        `${Number(subcategory.id_categoria)}:${normalizePiezaImportValue(subcategory.descripcion)}`,
        Number(subcategory.id),
      ])
    );
    const subcategoryByRow = new Map<number, number>();

    for (const row of validRows) {
      const normalizedCategory = normalizePiezaImportValue(row.categoria);
      let categoryId = categoryIds.get(normalizedCategory);
      if (!categoryId) {
        const inserted = await client.query<{ id: number; descripcion: string }>(
          "INSERT INTO public.categoria (descripcion) VALUES ($1) RETURNING id, descripcion",
          [row.categoria]
        );
        categoryId = Number(inserted.rows[0].id);
        categoryIds.set(normalizedCategory, categoryId);
        results.categoriesCreated.push(inserted.rows[0].descripcion);
      }

      const normalizedSubcategory = normalizePiezaImportValue(row.subcategoria);
      const subcategoryKey = `${categoryId}:${normalizedSubcategory}`;
      let subcategoryId = subcategoryIds.get(subcategoryKey);
      if (!subcategoryId) {
        const inserted = await client.query<{ id: number; descripcion: string }>(
          "INSERT INTO public.subcategoria (descripcion, id_categoria) VALUES ($1, $2) RETURNING id, descripcion",
          [row.subcategoria, categoryId]
        );
        subcategoryId = Number(inserted.rows[0].id);
        subcategoryIds.set(subcategoryKey, subcategoryId);
        results.subcategoriesCreated.push(`${row.categoria} / ${inserted.rows[0].descripcion}`);
      }

      subcategoryByRow.set(row.row, subcategoryId);
    }

    const upsertResult = await client.query<{ id: number; codigo_pieza: number; is_new: boolean }>(`
      INSERT INTO public.pieza (codigo_pieza, descripcion, medida, id_subcategoria)
      SELECT *
      FROM UNNEST($1::integer[], $2::text[], $3::text[], $4::integer[])
        AS datos(codigo_pieza, descripcion, medida, id_subcategoria)
      ON CONFLICT (codigo_pieza) DO UPDATE SET
        descripcion = EXCLUDED.descripcion,
        medida = EXCLUDED.medida,
        id_subcategoria = EXCLUDED.id_subcategoria,
        updated_at = NOW()
      RETURNING id, codigo_pieza, (xmax = 0) AS is_new
    `, [
      validRows.map((row) => row.codigoPieza),
      validRows.map((row) => row.descripcion),
      validRows.map((row) => row.medida),
      validRows.map((row) => subcategoryByRow.get(row.row) as number),
    ]);

    const pieceIdsByCode = new Map<number, number>();
    upsertResult.rows.forEach((piece) => {
      pieceIdsByCode.set(Number(piece.codigo_pieza), Number(piece.id));
      if (piece.is_new) results.created += 1;
      else results.updated += 1;
    });

    const pieceIds = Array.from(pieceIdsByCode.values());
    await client.query("DELETE FROM public.pieza_codigo_referencia WHERE id_pieza = ANY($1::integer[])", [pieceIds]);

    const codeLinks = validRows.flatMap((row) => {
      const idPieza = pieceIdsByCode.get(row.codigoPieza) as number;
      return [
        ...row.originales.map((codigo) => ({ idPieza, codigo, tipo: "ORIGINAL" })),
        ...row.equivalentes.map((codigo) => ({ idPieza, codigo, tipo: "EQUIVALENTE" })),
        ...row.sustitutos.map((codigo) => ({ idPieza, codigo, tipo: "SUSTITUTO" })),
      ];
    });

    if (codeLinks.length > 0) {
      const uniqueCodes = Array.from(new Set(codeLinks.map((link) => normalizePiezaImportValue(link.codigo))));
      const existingCodes = await client.query<{ id: number; codigo: string }>(`
        SELECT id, UPPER(TRIM(codigo)) AS codigo
        FROM public.codigo_referencia
        WHERE UPPER(TRIM(codigo)) = ANY($1::text[])
      `, [uniqueCodes]);
      const codeIds = new Map(existingCodes.rows.map((code) => [code.codigo, Number(code.id)]));
      const missingCodes = uniqueCodes.filter((code) => !codeIds.has(code));

      if (missingCodes.length > 0) {
        const insertedCodes = await client.query<{ id: number; codigo: string }>(`
          INSERT INTO public.codigo_referencia (codigo)
          SELECT * FROM UNNEST($1::text[])
          RETURNING id, UPPER(TRIM(codigo)) AS codigo
        `, [missingCodes]);
        insertedCodes.rows.forEach((code) => codeIds.set(code.codigo, Number(code.id)));
      }

      await client.query(`
        INSERT INTO public.pieza_codigo_referencia (id_pieza, id_codigo_referencia, tipo)
        SELECT * FROM UNNEST($1::integer[], $2::integer[], $3::text[])
        ON CONFLICT DO NOTHING
      `, [
        codeLinks.map((link) => link.idPieza),
        codeLinks.map((link) => codeIds.get(normalizePiezaImportValue(link.codigo)) as number),
        codeLinks.map((link) => link.tipo),
      ]);
    }

    await client.query(`
      SELECT setval(
        'public.pieza_codigo_pieza_seq',
        GREATEST(COALESCE((SELECT MAX(codigo_pieza) FROM public.pieza), 1), 1),
        true
      )
    `);
    await cleanupOrphanedCodes(client);
    revalidateTag("meta");

    return results;
  });
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

export async function getPiezasBusquedaLive(searchTerm: string): Promise<PiezaBusqueda[]> {
  const term = `%${searchTerm.toUpperCase().trim()}%`;
  
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
    HAVING 
      CAST(p.codigo_pieza AS TEXT) LIKE $1 OR
      UPPER(p.descripcion) LIKE $1 OR
      UPPER(c.descripcion) LIKE $1 OR
      UPPER(s.descripcion) LIKE $1 OR
      EXISTS (
        SELECT 1 FROM pieza_codigo_referencia pcr2
        JOIN codigo_referencia cr2 ON cr2.id = pcr2.id_codigo_referencia
        WHERE pcr2.id_pieza = p.id AND UPPER(cr2.codigo) LIKE $1
      )
    ORDER BY p.codigo_pieza ASC
    LIMIT 20
  `;
  
  const { rows } = await query(sql, [term]);
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
        buildConflictMessage("Estos números originales ya existen en otros items asociados", originalConflicts)
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
        buildConflictMessage("Estos números originales ya existen en otros items asociados", originalConflicts)
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
      const err = new Error("Item asociado no encontrado");
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
    const err = new Error("No se puede eliminar el item asociado porque está vinculado a items");
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
