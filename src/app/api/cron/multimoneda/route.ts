import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { query } from "@/lib/db-utils";
import { sincronizarCotizacionesAutomaticas } from "@/lib/multimoneda";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const runtime = "nodejs";

async function isAuthorized(request: NextRequest) {
  const providedSecret = request.headers.get("x-imc-multimoneda-cron");
  if (!providedSecret) return false;

  const result = await query<{ cron_multimoneda_secret_hash: string | null }>(
    "SELECT cron_multimoneda_secret_hash FROM public.multimoneda_configuracion WHERE id = 1"
  );
  const expectedHash = result.rows[0]?.cron_multimoneda_secret_hash;
  if (!expectedHash || !/^[a-f0-9]{64}$/i.test(expectedHash)) return false;
  if (providedSecret === expectedHash.toLowerCase()) return true;

  const actualHash = createHash("sha256").update(providedSecret).digest("hex");
  return actualHash === expectedHash.toLowerCase();
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
