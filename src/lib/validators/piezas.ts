import { AppError } from "@/lib/api-errors";

type PiezaPayload = {
  codigo_pieza: string;
  descripcion: string;
  medida: string;
  id_subcategoria: number;
  originales: string[];
  equivalentes: string[];
};

function sanitizeCodes(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map((v) => String(v ?? "").toUpperCase().trim()).filter(Boolean)));
}

export function validatePiezaPayload(body: any): PiezaPayload {
  const codigo_pieza = String(body?.codigo_pieza ?? "").toUpperCase().trim();
  const descripcion = String(body?.descripcion ?? "").toUpperCase().trim();
  const medida = String(body?.medida ?? "").toUpperCase().trim();
  const id_subcategoria = Number(body?.id_subcategoria);
  const originales = sanitizeCodes(body?.originales);
  const equivalentes = sanitizeCodes(body?.equivalentes);

  if (!codigo_pieza) throw new AppError("El código de pieza es obligatorio", 400);
  if (!descripcion) throw new AppError("La descripción es obligatoria", 400);
  if (!Number.isInteger(id_subcategoria) || id_subcategoria <= 0) {
    throw new AppError("La subcategoría es obligatoria", 400);
  }

  return { codigo_pieza, descripcion, medida, id_subcategoria, originales, equivalentes };
}
