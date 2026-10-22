import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiWriteSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";
import { consultarMensajeVenta, enviarMensajeVentaPrueba } from "@/lib/mercadolibre";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z.object({
  idCuenta: z.coerce.number().int().positive(),
  ventaId: z.string().trim().regex(/^\d{1,20}$/),
  texto: z.string().trim().min(1).max(350).optional(),
  accion: z.enum(["consultar", "enviar"]),
});

export async function POST(request: NextRequest) {
  try {
    await requireApiWriteSession(request);
    const payload = schema.parse(await request.json());
    if (payload.accion === "consultar") return NextResponse.json(await consultarMensajeVenta(payload.idCuenta, payload.ventaId), { headers: { "Cache-Control": "no-store" } });
    if (!payload.texto) return NextResponse.json({ message: "Escribi un mensaje." }, { status: 400 });
    return NextResponse.json(await enviarMensajeVentaPrueba(payload.idCuenta, payload.ventaId, payload.texto), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error, "No se pudo procesar el mensaje de prueba.");
  }
}
