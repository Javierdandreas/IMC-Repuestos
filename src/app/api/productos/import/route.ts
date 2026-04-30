import { NextRequest, NextResponse } from "next/server";
import { importProductos } from "@/modules/productos/repos/productos";
import { requireApiWriteSession } from "@/modules/auth/repos/api-auth";
import { jsonError } from "@/lib/api-errors";

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiWriteSession(request);
    const body = await request.json();
    
    if (!body.items || !Array.isArray(body.items)) {
      throw new Error("Formato de importación inválido");
    }

    const userName = session.nombreUsuario || session.email || "Usuario Desconocido";
    const fileName = body.fileName || "archivo_desconocido.csv";

    const results = await importProductos(body.items, userName, fileName, body.mappings);
    
    return NextResponse.json(results);
  } catch (error: unknown) {
    return jsonError(error, "Error durante la importación masiva");
  }
}
