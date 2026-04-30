import { NextRequest, NextResponse } from "next/server";
import { requireApiReadSession } from "@/modules/auth/repos/api-auth";
import { jsonError } from "@/lib/api-errors";
import { getImportacionesByProveedor } from "@/modules/importaciones/repos/proveedor-importaciones";

export async function GET(request: NextRequest) {
  try {
    // 1. Validar sesión de lectura
    await requireApiReadSession(request);

    // 2. Obtener parámetros
    const { searchParams } = new URL(request.url);
    const id_proveedor = searchParams.get("id_proveedor");

    if (!id_proveedor) {
      return NextResponse.json(
        { error: "id_proveedor es requerido" }, 
        { status: 400 }
      );
    }

    // 3. Consultar historial
    const history = await getImportacionesByProveedor(Number(id_proveedor));

    return NextResponse.json(history);

  } catch (error: any) {
    console.error("Error en GET /api/proveedores/importaciones:", error);
    return jsonError(error, "Error al obtener historial de importaciones");
  }
}
