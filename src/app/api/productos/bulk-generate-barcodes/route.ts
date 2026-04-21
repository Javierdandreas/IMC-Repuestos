import { NextResponse } from "next/server";
import { bulkUpdateBarcodes, generateUniqueBarcode } from "@/lib/repos/productos";

export async function POST(req: Request) {
  try {
    const { updates } = await req.json();

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: "Se requiere un array de actualizaciones" },
        { status: 400 }
      );
    }

    const processedUpdates = [];
    for (const update of updates) {
      let codBarra = update.cod_barra;
      // Si el código está vacío o es nulo, generamos uno nuevo "oficial" (estilo EAN-13 empezando con 200)
      if (!codBarra || codBarra.trim() === "") {
        codBarra = await generateUniqueBarcode();
      }
      processedUpdates.push({ ...update, cod_barra: codBarra });
    }

    await bulkUpdateBarcodes(processedUpdates);

    return NextResponse.json({ 
      success: true, 
      count: processedUpdates.length,
      updates: processedUpdates // Devolvemos los códigos generados para el cliente
    });
  } catch (error: any) {
    console.error("Error in bulk-generate-barcodes:", error);
    return NextResponse.json(
      { error: "Error al actualizar códigos de barras" },
      { status: 500 }
    );
  }
}
