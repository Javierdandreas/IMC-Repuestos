import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/api-errors";
import { requireApiReadSession } from "@/lib/api-auth";
import { buscarCandidatosVinculoMercadoLibre } from "@/lib/mercadolibre";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireApiReadSession(request);
    return NextResponse.json(
      await buscarCandidatosVinculoMercadoLibre(request.nextUrl.searchParams.get("q") || ""),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return jsonError(error, "No se pudieron buscar items y kits para vincular.");
  }
}
