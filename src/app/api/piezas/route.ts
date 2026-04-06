import { NextRequest, NextResponse } from "next/server";
import { createPieza } from "@/lib/repos/piezas";
import { requireApiSession } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  await requireApiSession(request);
  try {
    const body = await request.json();
    const result = await createPieza({
      descripcion: String(body.descripcion ?? ""),
      medida: String(body.medida ?? ""),
      id_subcategoria: Number(body.id_subcategoria),
      originales: Array.isArray(body.originales) ? body.originales : [],
      equivalentes: Array.isArray(body.equivalentes) ? body.equivalentes : [],
    });

    return NextResponse.json({ ...result.pieza, warning: result.warning });
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || "No se pudo crear la pieza" },
      { status: error.status || 400 }
    );
  }
}
