import { NextRequest, NextResponse } from "next/server";

import { requireApiWriteSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";
import { importProveedores } from "@/lib/repos/catalogos";

export async function POST(request: NextRequest) {
  try {
    await requireApiWriteSession(request);
    const body = await request.json();

    if (!Array.isArray(body.items)) {
      throw new Error("El archivo de proveedores no tiene filas validas");
    }

    return NextResponse.json(await importProveedores(body.items));
  } catch (error) {
    return jsonError(error, "No se pudieron importar los proveedores");
  }
}
