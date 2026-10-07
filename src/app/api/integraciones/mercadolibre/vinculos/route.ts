import { NextRequest, NextResponse } from "next/server";

import { AppError, jsonError } from "@/lib/api-errors";
import { requireApiReadSession } from "@/lib/api-auth";
import { getMercadoLibreVinculos } from "@/lib/mercadolibre";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireApiReadSession(request);
    const tipo = request.nextUrl.searchParams.get("tipo");
    const id = Number(request.nextUrl.searchParams.get("id"));
    if ((tipo !== "ITEM" && tipo !== "KIT") || !Number.isInteger(id) || id <= 0) {
      throw new AppError("El vínculo solicitado no es válido.", 400);
    }
    return NextResponse.json(await getMercadoLibreVinculos(tipo, id), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error, "No se pudieron consultar los vínculos de Mercado Libre.");
  }
}
