import { NextRequest, NextResponse } from "next/server";
import { requireApiWriteSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";
import { aplicarImportacionAlCatalogo, createImportacion } from "@/lib/repos/proveedor-importaciones";
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
    const cleanItems = body.items.map((item, index) => {
      const parsedPrice = item.precio_lista === null || item.precio_lista === undefined
        ? null
        : Number(item.precio_lista);

      return {
        fila: Number(item.fila || index + 2),
        proveedor_archivo: String(item.proveedor_archivo ?? "").trim(),
        codigo_proveedor: String(item.codigo_proveedor ?? "").trim().toUpperCase(),
        precio_lista: Number.isFinite(parsedPrice) ? parsedPrice : null,
        precio_original: String(item.precio_original ?? item.precio_lista ?? "").trim(),
      };
    });

    if (cleanItems.length === 0) {
      return NextResponse.json({ error: "No hay filas para importar" }, { status: 400 });
    }

    const importacion = await createImportacion({ ...body, items: cleanItems });
    const applyResult = await aplicarImportacionAlCatalogo(Number(importacion.id));

    return NextResponse.json({
      message: "Importación aplicada exitosamente",
      data: importacion,
      updatedCount: applyResult.updatedCount,
      recalculatedCostCount: applyResult.recalculatedCostCount,
      notFoundCount: applyResult.notFoundCount,
      invalidCount: applyResult.invalidCount,
      duplicateCount: applyResult.duplicateCount,
      providerMismatchCount: applyResult.providerMismatchCount,
    });

  } catch (error: any) {
    console.error("Error en POST /api/proveedores/importar:", error);
    return jsonError(error, "Error al procesar la importación del proveedor");
  }
}
