import { NextRequest, NextResponse } from "next/server";
import { requireApiReadSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";
import { getUltimoItemProveedor } from "@/lib/repos/proveedor-importaciones";

export async function GET(request: NextRequest) {
  try {
    // 1. Validar sesión de lectura
    await requireApiReadSession(request);

    // 2. Obtener parámetros
    const { searchParams } = new URL(request.url);
    const id_proveedor = searchParams.get("id_proveedor");
    const codigo_proveedor = searchParams.get("codigo_proveedor");

    if (!id_proveedor || !codigo_proveedor) {
      return NextResponse.json(
        { error: "id_proveedor y codigo_proveedor son requeridos" }, 
        { status: 400 }
      );
    }

    // 3. Consultar ítem
    const item = await getUltimoItemProveedor(
      Number(id_proveedor), 
      codigo_proveedor.trim()
    );

    if (!item) {
      return NextResponse.json(
        { message: "No se encontró información para este código y proveedor", data: null },
        { status: 404 }
      );
    }

    return NextResponse.json(item);

  } catch (error: any) {
    console.error("Error en GET /api/proveedores/ultimo-item:", error);
    return jsonError(error, "Error al consultar el último ítem del proveedor");
  }
}
