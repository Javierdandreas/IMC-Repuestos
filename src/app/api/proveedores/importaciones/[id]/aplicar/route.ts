import { NextRequest, NextResponse } from "next/server";

import { requireApiWriteSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";
import { aplicarImportacionAlCatalogo } from "@/lib/repos/proveedor-importaciones";

type Params = Promise<{ id: string }>;

export async function POST(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    await requireApiWriteSession(request);

    const { id } = await params;
    const importacionId = parseInt(id, 10);

    if (Number.isNaN(importacionId)) {
      return NextResponse.json({ error: "ID de importacion invalido" }, { status: 400 });
    }

    const result = await aplicarImportacionAlCatalogo(importacionId);

    return NextResponse.json({
      message: "Lista aplicada correctamente",
      updatedCount: result.updatedCount,
      recalculatedCostCount: result.recalculatedCostCount,
      notFoundCount: result.notFoundCount,
      invalidCount: result.invalidCount,
      duplicateCount: result.duplicateCount,
      providerMismatchCount: result.providerMismatchCount,
    });
  } catch (error: any) {
    console.error("Error en POST /api/proveedores/importaciones/[id]/aplicar:", error);
    return jsonError(error, "Error al aplicar la importacion del proveedor");
  }
}
