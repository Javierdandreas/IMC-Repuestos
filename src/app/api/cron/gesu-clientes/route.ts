import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-errors";
import { sincronizarClientesGesu } from "@/lib/gesu-clientes";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ message: "Cron no configurado." }, { status: 503 });
  if (!authorized(request)) return NextResponse.json({ message: "No autorizado." }, { status: 401 });
  try {
    return NextResponse.json(await sincronizarClientesGesu(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error, "No se pudo sincronizar clientes desde GESU.");
  }
}
