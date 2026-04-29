import { NextRequest, NextResponse } from "next/server";
import { ImportacionService } from "@/modules/importaciones/services/importacion-service";
import { requireApiPermission } from "@/modules/auth/repos/api-auth";
import { jsonError } from "@/lib/api-errors";

export async function GET(request: NextRequest) {
  try {
    await requireApiPermission(request, "proveedores.ver");
    
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const logs = await ImportacionService.listLogs(page, limit);
    return NextResponse.json(logs);
  } catch (error: unknown) {
    return jsonError(error, "Error al obtener historial de importaciones");
  }
}
