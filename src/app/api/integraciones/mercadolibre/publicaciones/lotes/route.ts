import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiWriteSession } from "@/lib/api-auth";
import { AppError, jsonError } from "@/lib/api-errors";
import { crearLote, obtenerLote, procesarSiguienteLote } from "@/lib/mercadolibre-lotes";
import { validarTitulosLote } from "@/lib/mercadolibre-lote-validacion";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const base = z.object({ tipo: z.enum(["ITEM", "KIT"]), id: z.number().int().positive() });
const nuevo = base.extend({ publicacion: z.number().int().positive(), titulos: z.array(z.string().trim().min(1).max(60)).min(1).max(20), descripcion: z.string().max(50000), confirmar: z.literal(true) });
const procesar = base.extend({ lote: z.string().uuid() });

export async function GET(request: NextRequest) {
  try {
    await requireApiWriteSession(request);
    const params = request.nextUrl.searchParams;
    const { tipo, id } = base.parse({ tipo: params.get("tipo"), id: Number(params.get("id")) });
    return NextResponse.json(await obtenerLote(tipo, id), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error, "No se pudo consultar el lote."); }
}

export async function POST(request: NextRequest) {
  try {
    await requireApiWriteSession(request);
    const data = nuevo.parse(await request.json());
    if (!validarTitulosLote(data.titulos)) throw new AppError("Revisa los titulos y elimina los repetidos.", 400);
    return NextResponse.json(await crearLote(data.tipo, data.id, data.publicacion, data.titulos, data.descripcion), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error, "No se pudo guardar el lote. No se publicaron las lineas."); }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireApiWriteSession(request);
    const data = procesar.parse(await request.json());
    return NextResponse.json(await procesarSiguienteLote(data.tipo, data.id, data.lote), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error, "No se pudo confirmar el avance. Revisa Mercado Libre antes de continuar."); }
}
