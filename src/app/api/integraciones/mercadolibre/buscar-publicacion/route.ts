import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/api-errors";
import { requireApiReadSession } from "@/lib/api-auth";
import { buscarPublicacionesMercadoLibre } from "@/lib/mercadolibre";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireApiReadSession(request);
    return NextResponse.json(await buscarPublicacionesMercadoLibre(request.nextUrl.searchParams.get("q") || ""));
  } catch (error) {
    return jsonError(error, "No se pudieron buscar publicaciones de Mercado Libre.");
  }
}
