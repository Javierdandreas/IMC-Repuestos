import { NextRequest, NextResponse } from "next/server";
import { createPieza } from "@/lib/repos/piezas";
import { requireApiSession, requireApiWriteSession } from "@/lib/api-auth";
import { validatePiezaPayload } from "@/lib/validators/piezas";
import { jsonError } from "@/lib/api-errors";

export async function POST(request: NextRequest) {
  await requireApiWriteSession(request);
  try {
    const body = await request.json();
    const payload = validatePiezaPayload(body);
    const result = await createPieza(payload);

    return NextResponse.json({ ...result.pieza, warning: result.warning });
  } catch (error: unknown) {
    return jsonError(error, "No se pudo crear la pieza");
  }
}