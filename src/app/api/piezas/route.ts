import { NextRequest, NextResponse } from "next/server";
import { createPieza, getPiezasListado } from "@/lib/repos/piezas";
import { requireApiSession, requireApiWriteSession } from "@/lib/api-auth";
import { validatePiezaPayload } from "@/lib/validators/piezas";
import { jsonError } from "@/lib/api-errors";

export async function GET(request: NextRequest) {
  await requireApiSession(request);
  try {
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page")) || 1;
    const limit = Number(searchParams.get("limit")) || 50;

    const result = await getPiezasListado(page, limit);
    return NextResponse.json(result);
  } catch (error: unknown) {
    return jsonError(error, "No se pudieron obtener los items asociados");
  }
}

export async function POST(request: NextRequest) {
  await requireApiWriteSession(request);
  try {
    const body = await request.json();
    const payload = validatePiezaPayload(body);
    const result = await createPieza(payload);

    return NextResponse.json({ ...result.pieza, warning: result.warning });
  } catch (error: unknown) {
    return jsonError(error, "No se pudo crear el item asociado");
  }
}
