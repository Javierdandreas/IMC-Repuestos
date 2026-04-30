import { NextRequest, NextResponse } from "next/server";
import { requireApiWriteSession } from "@/modules/auth/repos/api-auth";
import { jsonError } from "@/lib/api-errors";
import { aplicarImportacionAlCatalogo } from "@/modules/importaciones/repos/proveedor-importaciones";

type Params = Promise<{ id: string }>;

export async function POST(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    // 1. Validar sesión
    await requireApiWriteSession(request);

    // 2. Obtener ID
    const { id } = await params;
    const importacionId = parseInt(id, 10);

    if (isNaN(importacionId)) {
      return NextResponse.json({ error: "ID de importación inválido" }, { status: 400 });
    }

    // 3. Obtener descuentos del body
    const body = await request.json().catch(() => ({}));
    const { descuentoGeneral = 0, descuentosPorMarca = {} } = body;

    // 4. Aplicar al catálogo
    const result = await aplicarImportacionAlCatalogo(
      importacionId,
      Number(descuentoGeneral),
      descuentosPorMarca
    );

    return NextResponse.json({
      message: "Importación aplicada al catálogo correctamente",
      updatedCount: result.updatedCount
    });

  } catch (error: any) {
    console.error("Error en POST /api/proveedores/importaciones/[id]/aplicar:", error);
    return jsonError(error, "Error al aplicar la importación al catálogo");
  }
}
