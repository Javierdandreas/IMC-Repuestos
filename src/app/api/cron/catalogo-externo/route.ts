import { NextRequest, NextResponse } from "next/server";
import { syncExternalCatalogAutomatically } from "@/lib/catalogo-externo";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    console.error("[CATALOGO EXTERNO CRON] Falta configurar CRON_SECRET.");
    return NextResponse.json({ message: "Cron no configurado." }, { status: 503 });
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "No autorizado." }, { status: 401 });
  }

  try {
    const result = await syncExternalCatalogAutomatically();
    return NextResponse.json({
      ok: true,
      snapshotId: result.preview.snapshotId,
      syncRunId: result.preview.syncRunId,
      products: result.preview.products,
      groups: result.preview.groups,
      errorCount: result.preview.errorCount,
      imported: result.imported,
      batchLimit: result.batchLimit,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[CATALOGO EXTERNO CRON] Error al importar la revision:", error);
    return NextResponse.json({ message: "No se pudo importar el catalogo externo." }, { status: 500 });
  }
}
