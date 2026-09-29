import { NextRequest, NextResponse } from "next/server";
import { requireApiWriteSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";
import { iniciarImportacionProveedor } from "@/lib/repos/proveedor-importaciones";

export async function POST(request: NextRequest) {
  try {
    await requireApiWriteSession(request);
    const body = await request.json();
    const idProveedor = Number(body.id_proveedor);
    const totalItems = Number(body.total_items);
    const nombreArchivo = String(body.nombre_archivo ?? "lista-precios.csv").trim();

    return NextResponse.json(await iniciarImportacionProveedor(idProveedor, nombreArchivo, totalItems));
  } catch (error: unknown) {
    return jsonError(error, "No se pudo iniciar la importacion del proveedor");
  }
}
