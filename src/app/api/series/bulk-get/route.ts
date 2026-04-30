import { NextRequest, NextResponse } from "next/server";
import { getSeriesPorVariosProductos } from "@/modules/series/repos/series";

export async function POST(req: NextRequest) {
  try {
    const { productIds } = await req.json();

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json(
        { error: "Se requiere un array de IDs de productos" },
        { status: 400 }
      );
    }

    const series = await getSeriesPorVariosProductos(productIds);

    return NextResponse.json({ success: true, series });
  } catch (error: any) {
    console.error("Error in series/bulk-get:", error);
    return NextResponse.json(
      { error: "Error al obtener números de serie" },
      { status: 500 }
    );
  }
}
