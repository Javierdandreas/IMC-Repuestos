import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api-auth";
import { getNextCodigoPieza } from "@/lib/repos/piezas";

export async function GET(request: NextRequest) {
  await requireApiSession(request);
  try {
    const codigo_pieza = await getNextCodigoPieza();
    return NextResponse.json({ codigo_pieza });
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || "No se pudo obtener el próximo número de pieza" },
      { status: error.status || 400 }
    );
  }
}
