import { NextRequest, NextResponse } from "next/server";
import { requireApiWriteSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";
import { normalizarItemsImportacionProveedor } from "@/lib/proveedor-import-payload";
import { agregarItemsImportacionProveedor } from "@/lib/repos/proveedor-importaciones";

export async function POST(request: NextRequest) {
  try {
    await requireApiWriteSession(request);
    const body = await request.json();
    if (!Array.isArray(body.items)) throw new Error("El lote de items es invalido");

    const idImportacion = Number(body.id_importacion);
    const idProveedor = Number(body.id_proveedor);
    const items = normalizarItemsImportacionProveedor(body.items);
    return NextResponse.json(await agregarItemsImportacionProveedor(idImportacion, idProveedor, items));
  } catch (error: unknown) {
    return jsonError(error, "No se pudo guardar el lote de la importacion");
  }
}
