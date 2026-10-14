import { NextRequest, NextResponse } from "next/server";

import { AppError, jsonError } from "@/lib/api-errors";
import { requireApiWriteSession } from "@/lib/api-auth";
import { eliminarMercadoLibreRespuestaRapida, guardarMercadoLibreRespuestaRapida } from "@/lib/mercadolibre-respuestas-rapidas";

function ids(request: NextRequest, rawId: string) {
  const idCuenta = Number(request.nextUrl.searchParams.get("idCuenta"));
  const id = Number(rawId);
  if (!Number.isInteger(idCuenta) || idCuenta <= 0 || !Number.isInteger(id) || id <= 0) {
    throw new AppError("La respuesta rapida no es valida.", 400);
  }
  return { idCuenta, id };
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireApiWriteSession(request);
    const idsValue = ids(request, (await params).id);
    const body = await request.json();
    return NextResponse.json(await guardarMercadoLibreRespuestaRapida(idsValue.idCuenta, { ...body, id: idsValue.id }));
  } catch (error) {
    return jsonError(error, "No se pudo actualizar la respuesta rapida.");
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireApiWriteSession(request);
    const idsValue = ids(request, (await params).id);
    await eliminarMercadoLibreRespuestaRapida(idsValue.idCuenta, idsValue.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error, "No se pudo eliminar la respuesta rapida.");
  }
}
