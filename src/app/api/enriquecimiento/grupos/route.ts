import { NextRequest, NextResponse } from "next/server";
import { getEnriquecimientoGrupos, type EstadoEnriquecimiento } from "@/lib/repos/enriquecimiento";
import { requireApiSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";

const ESTADOS = new Set<EstadoEnriquecimiento>(["PENDIENTES", "ENRIQUECIDOS", "TODOS"]);

function optionalPositiveInt(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(request: NextRequest) {
  await requireApiSession(request);
  try {
    const { searchParams } = new URL(request.url);
    const rawEstado = searchParams.get("estado") ?? "TODOS";
    const estado = ESTADOS.has(rawEstado as EstadoEnriquecimiento)
      ? rawEstado as EstadoEnriquecimiento
      : "TODOS";

    return NextResponse.json(await getEnriquecimientoGrupos({
      page: optionalPositiveInt(searchParams.get("page")) ?? 1,
      limit: 50,
      estado,
      search: searchParams.get("q") ?? undefined,
      categoria: optionalPositiveInt(searchParams.get("categoria")),
      subcategoria: optionalPositiveInt(searchParams.get("subcategoria")),
      marca: optionalPositiveInt(searchParams.get("marca")),
      proveedor: optionalPositiveInt(searchParams.get("proveedor")),
    }));
  } catch (error: unknown) {
    return jsonError(error, "No se pudo generar el informe agrupado.");
  }
}
