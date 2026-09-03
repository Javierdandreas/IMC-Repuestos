import { NextRequest, NextResponse } from "next/server";
import { generateAutoSeriesForProduct } from "@/lib/repos/series";
import { requireApiWriteSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";

export async function POST(req: NextRequest) {
  try {
    const session = await requireApiWriteSession(req);
    const { productIds, requests } = await req.json();
    const generationRequests = Array.isArray(requests)
      ? requests
          .map((item) => ({
            id: Number(item?.id),
            targetTotal: Number(item?.targetTotal),
          }))
          .filter((item) => Number.isFinite(item.id) && item.id > 0)
      : Array.isArray(productIds)
        ? productIds
            .map((id) => ({ id: Number(id), targetTotal: undefined }))
            .filter((item) => Number.isFinite(item.id) && item.id > 0)
        : [];

    if (generationRequests.length === 0) {
      return NextResponse.json(
        { error: "Se requiere un array de IDs de items" },
        { status: 400 }
      );
    }

    // Usar el ID de usuario de la sesión
    const userId = session.usuarioId;

    const results = [];
    for (const requestItem of generationRequests) {
      try {
        const series = await generateAutoSeriesForProduct(
          requestItem.id,
          Number(userId),
          Number.isFinite(requestItem.targetTotal) ? requestItem.targetTotal : undefined
        );
        results.push({ id: requestItem.id, status: "success", count: series.length });
      } catch (err: any) {
        results.push({ id: requestItem.id, status: "error", message: err.message });
      }
    }

    const successCount = results.filter((result) => result.status === "success").length;
    return NextResponse.json({ success: successCount > 0, results });
  } catch (error: any) {
    return jsonError(error, "Error en generación masiva de series");
  }
}
