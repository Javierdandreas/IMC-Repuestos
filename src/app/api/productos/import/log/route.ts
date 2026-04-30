import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db-utils";
import { requireApiWriteSession } from "@/modules/auth/repos/api-auth";
import { jsonError } from "@/lib/api-errors";

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiWriteSession(request);
    const body = await request.json();
    
    if (!body.fileName) {
      throw new Error("Falta el nombre del archivo");
    }

    const userName = session.nombreUsuario || session.email || "Usuario Desconocido";
    
    await query(
      `INSERT INTO log_importaciones (
        usuario, archivo, items_importados, items_ignorados, cantidad_errores, detalles_errores, duracion_ms
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        userName, 
        body.fileName, 
        (body.imported || 0) + (body.updated || 0), 
        body.ignored || 0, 
        body.errors?.length || 0, 
        JSON.stringify(body.errors || []), 
        body.durationMs || 0
      ]
    );
    
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return jsonError(error, "Error guardando el log de importación");
  }
}
