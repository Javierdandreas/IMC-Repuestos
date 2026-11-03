import { NextRequest, NextResponse } from "next/server";
import { failGesuSyncRun, finishGesuSyncRun, startGesuSyncRun, syncExternalCatalogAutomatically } from "@/lib/catalogo-externo";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    console.error("[GESU CRON] Falta configurar CRON_SECRET.");
    return NextResponse.json({ message: "Cron no configurado." }, { status: 503 });
  }
  if (!isAuthorized(request)) return NextResponse.json({ message: "No autorizado." }, { status: 401 });

  let runId: number | null = null;
  try {
    runId = await startGesuSyncRun();
  } catch (logError) {
    // El historial es observabilidad: una migracion pendiente no debe detener
    // la sincronizacion operativa de productos desde GESU.
    console.error("[GESU CRON] No se pudo iniciar el registro de historial:", logError);
  }

  try {
    const result = await syncExternalCatalogAutomatically();
    if (runId !== null) {
      try {
        await finishGesuSyncRun(runId, {
          totalItemsLeidos: result.preview.sourceRows,
          productosNuevos: result.imported.products?.created ?? 0,
          kitsNuevos: result.imported.groups?.created ?? 0,
          productosModificados: result.existing.updated,
          errorCount: result.preview.errorCount,
          errores: result.preview.errors,
        });
      } catch (logError) {
        console.error("[GESU CRON] No se pudo finalizar el registro de historial:", logError);
      }
    }
    return NextResponse.json({
      ok: true,
      runId,
      snapshotId: result.preview.snapshotId,
      syncRunId: result.preview.syncRunId,
      products: result.preview.products,
      groups: result.preview.groups,
      errorCount: result.preview.errorCount,
      imported: result.imported,
      updatedExisting: result.existing,
      batchLimit: result.batchLimit,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[GESU CRON] Error al sincronizar:", error);
    if (runId !== null) {
      try {
        await failGesuSyncRun(runId, error);
      } catch (logError) {
        console.error("[GESU CRON] No se pudo registrar el error:", logError);
      }
    }
    return NextResponse.json({ message: "No se pudo sincronizar GESU." }, { status: 500 });
  }
}
