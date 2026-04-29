import { NextRequest, NextResponse } from "next/server";
import { ImportacionService } from "@/modules/importaciones/services/importacion-service";
import { requireApiPermission } from "@/modules/auth/repos/api-auth";
import { jsonError } from "@/lib/api-errors";

export async function POST(request: NextRequest) {
  try {
    await requireApiPermission(request, "proveedores.importar");

    const body = await request.json();
    const importacion = await ImportacionService.importarDeProveedor(body);

    return NextResponse.json({
      message: "Importación creada exitosamente",
      data: importacion
    });

  } catch (error: any) {
    console.error("Error en POST /api/proveedores/importar:", error);
    return jsonError(error, "Error al procesar la importación del proveedor");
  }
}
