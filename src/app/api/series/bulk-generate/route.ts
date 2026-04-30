import { NextRequest, NextResponse } from "next/server";
import { generateAutoSeriesForProduct } from "@/modules/series/repos/series";
import { requireApiWriteSession } from "@/modules/auth/repos/api-auth";
import { jsonError } from "@/lib/api-errors";

export async function POST(req: NextRequest) {
  try {
    const session = await requireApiWriteSession(req);
    const { productIds } = await req.json();

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json(
        { error: "Se requiere un array de IDs de productos" },
        { status: 400 }
      );
    }

    // Usar el ID de usuario de la sesión
    const userId = session.usuarioId;

    const results = [];
    for (const id of productIds) {
      try {
        const series = await generateAutoSeriesForProduct(Number(id), Number(userId));
        results.push({ id, status: "success", count: series.length });
      } catch (err: any) {
        results.push({ id, status: "error", message: err.message });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    return jsonError(error, "Error en generación masiva de series");
  }
}
