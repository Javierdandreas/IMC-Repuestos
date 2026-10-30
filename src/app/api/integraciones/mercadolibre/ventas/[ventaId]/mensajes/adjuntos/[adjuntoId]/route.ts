import { NextRequest, NextResponse } from "next/server";

import { AppError, jsonError } from "@/lib/api-errors";
import { requireApiReadSession } from "@/lib/api-auth";
import { getMercadoLibreVentaAdjunto } from "@/lib/mercadolibre";

export const dynamic = "force-dynamic";

function accountId(request: NextRequest) {
  const value = Number(request.nextUrl.searchParams.get("idCuenta"));
  if (!Number.isInteger(value) || value <= 0) throw new AppError("La cuenta de Mercado Libre no es valida.", 400);
  return value;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ ventaId: string; adjuntoId: string }> }) {
  try {
    await requireApiReadSession(request);
    const { ventaId, adjuntoId } = await params;
    const adjunto = await getMercadoLibreVentaAdjunto(accountId(request), ventaId, adjuntoId);
    return new NextResponse(adjunto.contenido, {
      headers: {
        "Cache-Control": "private, max-age=300",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(adjunto.nombre)}`,
        "Content-Type": adjunto.tipo,
      },
    });
  } catch (error) {
    return jsonError(error, "No se pudo obtener el adjunto de Mercado Libre.");
  }
}
