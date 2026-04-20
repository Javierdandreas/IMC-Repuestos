import { NextResponse } from "next/server";
import { bulkUpdateBarcodes } from "@/lib/repos/productos";

export async function POST(req: Request) {
  try {
    const { updates } = await req.json();

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: "Se requiere un array de actualizaciones" },
        { status: 400 }
      );
    }

    await bulkUpdateBarcodes(updates);

    return NextResponse.json({ success: true, count: updates.length });
  } catch (error: any) {
    console.error("Error in bulk-generate-barcodes:", error);
    return NextResponse.json(
      { error: "Error al actualizar códigos de barras" },
      { status: 500 }
    );
  }
}
