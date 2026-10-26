import { NextRequest, NextResponse } from "next/server";
import { crearPiezaDesdeItems } from "@/lib/repos/enriquecimiento";
import { requireApiWriteSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";

export async function POST(request: NextRequest) {
  await requireApiWriteSession(request);
  try {
    const body = await request.json();
    return NextResponse.json(await crearPiezaDesdeItems({
      ids: body?.ids,
      id_descripcion: body?.id_descripcion,
      descripcion: body?.descripcion,
      medida: body?.medida,
      imagen_medida_url: body?.imagen_medida_url,
      originales: body?.originales,
      equivalentes: body?.equivalentes,
      sustitutos: body?.sustitutos,
    }));
  } catch (error: unknown) {
    return jsonError(error, "No se pudo crear el numero de pieza.");
  }
}
