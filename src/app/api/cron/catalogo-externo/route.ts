import { NextRequest, NextResponse } from "next/server";

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

  // Se conserva temporalmente para que los cron jobs externos antiguos no
  // consulten GESU una segunda vez. El cron activo es /api/cron/gesu.
  return NextResponse.json({
    ok: true,
    disabled: true,
    message: "Este cron fue reemplazado por /api/cron/gesu.",
  }, { headers: { "Cache-Control": "no-store" } });
}
