import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api-auth";
import { getNextCodigoPieza } from "@/lib/repos/piezas";
import { jsonError } from "@/lib/api-errors";

export async function GET(request: NextRequest) {
  await requireApiSession(request);
  try {
    const codigo_pieza = await getNextCodigoPieza();
    return NextResponse.json({ codigo_pieza });
  } catch (error: unknown) {
    return jsonError(error, "No se pudo obtener el próximo número de item asociado");
  }
}
