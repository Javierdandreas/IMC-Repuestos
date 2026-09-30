import { NextRequest, NextResponse } from "next/server";
import { refreshExternalCatalogPreview } from "@/lib/catalogo-externo";

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
    const preview = await refreshExternalCatalogPreview();
    return NextResponse.json({
      ok: true,
      snapshotId: preview.snapshotId,
      syncRunId: preview.syncRunId,
      products: preview.products,
      groups: preview.groups,
      errorCount: preview.errorCount,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[CATALOGO EXTERNO CRON] Error al actualizar la revision:", error);
    return NextResponse.json({ message: "No se pudo actualizar el catalogo externo." }, { status: 500 });
  }
}
