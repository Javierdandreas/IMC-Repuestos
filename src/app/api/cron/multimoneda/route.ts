import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db-utils";
import { sincronizarCotizacionesAutomaticas } from "@/lib/multimoneda";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function isAuthorized(request: NextRequest) {
  const providedSecret = request.headers.get("x-imc-multimoneda-cron");
  if (!providedSecret) return false;

  const result = await query<{ decrypted_secret: string }>(
    "SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = $1",
    ["imc_multimoneda_cron_secret"]
  );
  const secret = result.rows[0]?.decrypted_secret;
  return Boolean(secret) && providedSecret === secret;
}

export async function GET(request: NextRequest) {
  try {
    if (!(await isAuthorized(request))) return NextResponse.json({ message: "No autorizado." }, { status: 401 });
    return NextResponse.json({ ok: true, ...(await sincronizarCotizacionesAutomaticas()) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[MULTIMONEDA CRON] Error al actualizar cotizaciones:", error);
    return NextResponse.json({ message: "No se pudieron actualizar las cotizaciones." }, { status: 500 });
  }
}
