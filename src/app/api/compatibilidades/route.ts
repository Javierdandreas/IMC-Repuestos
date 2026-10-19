import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-errors";
import { requireApiReadSession, requireApiWriteSession } from "@/lib/api-auth";
import { analizarPreguntasParaCompatibilidades, getCompatibilidadesCandidatas, type EstadoCompatibilidad } from "@/lib/repos/compatibilidades-mercadolibre";

const ESTADOS = new Set<EstadoCompatibilidad | "TODAS">(["PENDIENTE", "CONFIRMADA", "DESCARTADA", "TODAS"]);

function idCuenta(request: NextRequest) {
  const value = Number(request.nextUrl.searchParams.get("idCuenta"));
  if (!Number.isInteger(value) || value <= 0) throw new Error("Selecciona una cuenta de Mercado Libre valida.");
  return value;
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    await requireApiReadSession(request);
    const estado = request.nextUrl.searchParams.get("estado") || "PENDIENTE";
    return NextResponse.json(await getCompatibilidadesCandidatas({
      idCuenta: idCuenta(request),
      estado: ESTADOS.has(estado as EstadoCompatibilidad | "TODAS") ? estado as EstadoCompatibilidad | "TODAS" : "PENDIENTE",
      search: request.nextUrl.searchParams.get("q") || "",
      page: Number(request.nextUrl.searchParams.get("page")) || 1,
      limit: 50,
    }), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error, "No se pudo consultar el catalogo de compatibilidades.");
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireApiWriteSession(request);
    return NextResponse.json(await analizarPreguntasParaCompatibilidades(idCuenta(request)));
  } catch (error) {
    return jsonError(error, "No se pudieron analizar las preguntas historicas.");
  }
}
