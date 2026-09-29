import { NextRequest, NextResponse } from "next/server";
import { requireApiWriteSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";
import { finalizarCargaImportacionProveedor } from "@/lib/repos/proveedor-importaciones";

export async function POST(request: NextRequest) {
  try {
    await requireApiWriteSession(request);
    const body = await request.json();
    return NextResponse.json(await finalizarCargaImportacionProveedor(
      Number(body.id_importacion),
      Number(body.id_proveedor),
    ));
  } catch (error: unknown) {
    return jsonError(error, "No se pudo finalizar la carga de la importacion");
  }
}
