import { NextRequest, NextResponse } from "next/server";
import { requireApiWriteSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";
import { createImportacion } from "@/lib/repos/proveedor-importaciones";
import { CreateImportacionInput } from "@/interfaces/importaciones";

export async function POST(request: NextRequest) {
  try {
    // 1. Validar sesión de escritura
    await requireApiWriteSession(request);

    // 2. Obtener y validar el cuerpo
    const body: CreateImportacionInput = await request.json();

    if (!body.id_proveedor) {
      return NextResponse.json({ error: "ID de proveedor es requerido" }, { status: 400 });
    }

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: "La lista de ítems es requerida y debe ser un array no vacío" }, { status: 400 });
    }

    // 3. Ejecutar importación
    const importacion = await createImportacion(body);

    return NextResponse.json({
      message: "Importación creada exitosamente",
      data: importacion
    });

  } catch (error: any) {
    console.error("Error en POST /api/proveedores/importar:", error);
    return jsonError(error, "Error al procesar la importación del proveedor");
  }
}
