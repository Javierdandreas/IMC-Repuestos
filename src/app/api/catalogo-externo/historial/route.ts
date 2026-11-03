import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-errors";
import { requireApiReadSession } from "@/lib/api-auth";
import { getGesuSyncRuns } from "@/lib/catalogo-externo";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireApiReadSession(request);
    return NextResponse.json({ ejecuciones: await getGesuSyncRuns() }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return jsonError(error, "No se pudo consultar el historial de GESU.");
  }
}
