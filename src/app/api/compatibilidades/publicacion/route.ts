import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/api-errors";
import { requireApiReadSession } from "@/lib/api-auth";
import { consultarCompatibilidadesPublicacionMercadoLibre } from "@/lib/mercadolibre";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function page(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export async function GET(request: NextRequest) {
  try {
    await requireApiReadSession(request);
    const params = request.nextUrl.searchParams;
    return NextResponse.json(
      await consultarCompatibilidadesPublicacionMercadoLibre(params.get("itemId") || "", page(params.get("page"))),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return jsonError(error, "No se pudieron consultar las compatibilidades de la publicacion.");
  }
}
