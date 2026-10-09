import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { jsonError } from "@/lib/api-errors";
import { requireApiWriteSession } from "@/lib/api-auth";
import { responderPreguntaMercadoLibre } from "@/lib/mercadolibre";

export const dynamic = "force-dynamic";

const schema = z.object({
  idCuenta: z.coerce.number().int().positive(),
  preguntaId: z.string().trim().min(1),
  texto: z.string().trim().min(1).max(2_000),
});

export async function POST(request: NextRequest) {
  try {
    await requireApiWriteSession(request);
    const body = schema.parse(await request.json());
    await responderPreguntaMercadoLibre(body.idCuenta, body.preguntaId, body.texto);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error, "No se pudo responder la pregunta en Mercado Libre.");
  }
}
