import { AppError } from "@/lib/api-errors";

function normalizeDescripcion(value: unknown) {
  return String(value ?? "").trim();
}

export function parseCatalogDescripcion(body: unknown) {
  if (!body || typeof body !== "object") {
    throw new AppError("Datos inválidos", 400);
  }

  const descripcion = normalizeDescripcion((body as { descripcion?: unknown }).descripcion);
  if (!descripcion) {
    throw new AppError("La descripción es obligatoria", 400);
  }

  return { descripcion };
}

export function parseIdParam(rawId: string) {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError("ID inválido", 400);
  }
  return id;
}

export function parseSubcategoriaPayload(body: unknown) {
  if (!body || typeof body !== "object") {
    throw new AppError("Datos inválidos", 400);
  }

  const descripcion = normalizeDescripcion((body as { descripcion?: unknown }).descripcion);
  const id_categoria = Number((body as { id_categoria?: unknown }).id_categoria);

  if (!descripcion) {
    throw new AppError("La descripción es obligatoria", 400);
  }

  if (!Number.isInteger(id_categoria) || id_categoria <= 0) {
    throw new AppError("La categoría es obligatoria", 400);
  }

  return { descripcion, id_categoria };
}
