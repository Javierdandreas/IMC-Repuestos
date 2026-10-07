import { NextRequest, NextResponse } from "next/server";

import { AppError, jsonError } from "@/lib/api-errors";
import { requireApiWriteSession } from "@/lib/api-auth";
import { guardarVinculoManualMercadoLibre } from "@/lib/mercadolibre";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireApiWriteSession(request);
    const idPublicacion = Number((await params).id);
    if (!Number.isInteger(idPublicacion) || idPublicacion <= 0) throw new AppError("La publicación no es válida.", 400);
    const body = await request.json();
    const target = body?.target === null ? null : body?.target;
    if (target !== null && (!target || (target.tipo !== "ITEM" && target.tipo !== "KIT") || !Number.isInteger(Number(target.id)) || Number(target.id) <= 0)) {
      throw new AppError("El destino del vínculo no es válido.", 400);
    }
    await guardarVinculoManualMercadoLibre(idPublicacion, target === null ? null : { tipo: target.tipo, id: Number(target.id) });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error, "No se pudo guardar el vínculo de Mercado Libre.");
  }
}
