import { query } from "@/lib/db-utils";
import { AppError } from "@/lib/api-errors";

export type GesuCatalogType = "productos" | "kits";

const MAX_CODES_PER_REQUEST = 1000;

const normalizeCode = (value: unknown) => String(value ?? "").trim().toUpperCase();

/** Busca codigos existentes para clasificar altas y actualizaciones en una vista previa. */
export async function findExistingGesuCodes(type: GesuCatalogType, rawCodes: unknown[]) {
  const codes = Array.from(new Set(rawCodes.map(normalizeCode).filter(Boolean)));

  if (codes.length === 0) return [];
  if (codes.length > MAX_CODES_PER_REQUEST) {
    throw new AppError(`La consulta admite hasta ${MAX_CODES_PER_REQUEST} codigos por vez`, 400);
  }

  if (type === "productos") {
    const result = await query<{ code: string }>(
      `SELECT UPPER(cod_unico) AS code FROM public.productos WHERE UPPER(cod_unico) = ANY($1::text[])`,
      [codes]
    );
    return result.rows.map((row) => row.code);
  }

  const result = await query<{ code: string }>(
    `SELECT UPPER(codigo_kit) AS code FROM public.kits WHERE UPPER(codigo_kit) = ANY($1::text[])`,
    [codes]
  );
  return result.rows.map((row) => row.code);
}

export async function ocultarProductosConvertidosEnKit(rawCodes: unknown[]) {
  const codes = Array.from(new Set(rawCodes.map(normalizeCode).filter(Boolean)));

  if (codes.length === 0) return [];
  if (codes.length > MAX_CODES_PER_REQUEST) {
    throw new AppError(`La consulta admite hasta ${MAX_CODES_PER_REQUEST} codigos por vez`, 400);
  }

  const result = await query<{ code: string }>(
    `
      UPDATE public.productos
      SET oculto_por_kit = true
      WHERE UPPER(cod_unico) = ANY($1::text[])
      RETURNING UPPER(cod_unico) AS code
    `,
    [codes]
  );

  return result.rows.map((row) => row.code);
}
