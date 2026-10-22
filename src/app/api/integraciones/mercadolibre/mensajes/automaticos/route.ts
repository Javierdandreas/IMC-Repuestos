import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiReadSession, requireApiWriteSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";
import { configurarMensajesAutomaticos, obtenerMensajesAutomaticos } from "@/lib/mercadolibre";

export const dynamic = "force-dynamic";
const cuenta = z.coerce.number().int().positive();
const schema = z.object({ idCuenta: cuenta, activo: z.boolean(), texto: z.string().trim().min(1).max(350) });

export async function GET(request: NextRequest) {
  try {
    await requireApiReadSession(request);
    const idCuenta = cuenta.parse(request.nextUrl.searchParams.get("idCuenta"));
    return NextResponse.json(await obtenerMensajesAutomaticos(idCuenta), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error, "No se pudo consultar la configuracion de mensajes."); }
}

export async function PUT(request: NextRequest) {
  try {
    await requireApiWriteSession(request);
    const { idCuenta, activo, texto } = schema.parse(await request.json());
    return NextResponse.json(await configurarMensajesAutomaticos(idCuenta, activo, texto), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error, "No se pudo guardar la configuracion de mensajes."); }
}
