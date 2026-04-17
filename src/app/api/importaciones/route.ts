import { NextRequest, NextResponse } from "next/server";
import { getImportacionesLogs } from "@/lib/repos/productos";
import { requireApiReadSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";

export async function GET(request: NextRequest) {
  try {
    await requireApiReadSession(request);
    
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const logs = await getImportacionesLogs(page, limit);
    return NextResponse.json(logs);
  } catch (error: unknown) {
    return jsonError(error, "Error al obtener historial de importaciones");
  }
}
