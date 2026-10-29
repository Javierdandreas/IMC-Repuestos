import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { AppError, jsonError } from "@/lib/api-errors";
import { requireApiReadSession } from "@/lib/api-auth";
import { enviarMensajeVentaMercadoLibre, getMercadoLibreVentaConversacion } from "@/lib/mercadolibre";

export const dynamic = "force-dynamic";

function accountId(request: NextRequest) {
  const value = Number(request.nextUrl.searchParams.get("idCuenta"));
  if (!Number.isInteger(value) || value <= 0) throw new AppError("La cuenta de Mercado Libre no es valida.", 400);
  return value;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ ventaId: string }> }) {
  try {
    await requireApiReadSession(request);
    return NextResponse.json(await getMercadoLibreVentaConversacion(accountId(request), (await params).ventaId), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error, "No se pudo consultar el chat de la venta.");
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ ventaId: string }> }) {
  try {
    await requireApiReadSession(request);
    const body = z.object({ texto: z.string().trim().min(1).max(2000) }).parse(await request.json());
    return NextResponse.json(await enviarMensajeVentaMercadoLibre(accountId(request), (await params).ventaId, body.texto));
  } catch (error) {
    return jsonError(error, "No se pudo enviar el mensaje.");
  }
}
