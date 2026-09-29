import { NextRequest, NextResponse } from "next/server";
import { requireApiWriteSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";
import { importPreciosProveedores } from "@/lib/repos/productos";

export async function POST(request: NextRequest) {
  try {
    await requireApiWriteSession(request);
    const body = await request.json();
    if (!Array.isArray(body.items)) throw new Error("Formato de importacion invalido");
    return NextResponse.json(await importPreciosProveedores(body.items, body.mappings ?? {}));
  } catch (error: unknown) {
    return jsonError(error, "No se pudieron importar los precios de proveedores");
  }
}
