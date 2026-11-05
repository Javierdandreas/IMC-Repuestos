import { AppError } from "@/lib/api-errors";

const MERCADO_LIBRE_API_URL = "https://api.mercadolibre.com";
export const CATEGORIA_RAIZ_ACCESORIOS_VEHICULOS = "MLA5725";

export type MercadoLibreCategoria = {
  id: string;
  nombre: string;
  ruta: Array<{ id: string; nombre: string }>;
  hijas: Array<{ id: string; nombre: string }>;
};

type MercadoLibreCategoryResponse = {
  id?: unknown;
  name?: unknown;
  path_from_root?: unknown;
  children_categories?: unknown;
};

function texto(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function categoriaSimple(value: unknown): { id: string; nombre: string } | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const id = texto(source.id);
  const nombre = texto(source.name);
  return /^MLA\d+$/.test(id) && nombre ? { id, nombre } : null;
}

export function validarCategoriaMercadoLibreId(value: unknown) {
  const id = texto(value);
  if (!/^MLA\d+$/.test(id)) throw new AppError("La categoria de Mercado Libre no es valida.", 422);
  return id;
}

export async function obtenerCategoriaMercadoLibre(idCategoria: string): Promise<MercadoLibreCategoria> {
  const id = validarCategoriaMercadoLibreId(idCategoria);
  let response: Response;
  try {
    response = await fetch(`${MERCADO_LIBRE_API_URL}/categories/${encodeURIComponent(id)}`, {
      headers: { Accept: "application/json" },
      cache: "force-cache",
      next: { revalidate: 60 * 60 * 12 },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new AppError("No se pudo conectar con Mercado Libre para consultar las categorias.", 502);
  }

  if (!response.ok) {
    throw new AppError(response.status === 404
      ? "La categoria de Mercado Libre no existe."
      : "Mercado Libre no pudo devolver las categorias.", response.status === 404 ? 404 : 502);
  }

  const payload = await response.json() as MercadoLibreCategoryResponse;
  const categoria = categoriaSimple(payload);
  if (!categoria) throw new AppError("Mercado Libre devolvio una categoria invalida.", 502);

  const ruta = Array.isArray(payload.path_from_root)
    ? payload.path_from_root.map(categoriaSimple).filter((value): value is { id: string; nombre: string } => Boolean(value))
    : [];
  const hijas = Array.isArray(payload.children_categories)
    ? payload.children_categories.map(categoriaSimple).filter((value): value is { id: string; nombre: string } => Boolean(value))
    : [];

  return {
    id: categoria.id,
    nombre: categoria.nombre,
    ruta: ruta.length ? ruta : [categoria],
    hijas: hijas.sort((a, b) => a.nombre.localeCompare(b.nombre, "es-AR")),
  };
}
