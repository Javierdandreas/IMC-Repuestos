import { NextRequest, NextResponse } from "next/server";

import { requireApiReadSession } from "@/lib/api-auth";
import { AppError, jsonError } from "@/lib/api-errors";
import { query } from "@/lib/db-utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireApiReadSession(request);
    const idCuenta = Number(request.nextUrl.searchParams.get("idCuenta"));
    if (!Number.isInteger(idCuenta) || idCuenta <= 0) throw new AppError("La cuenta de Mercado Libre no es valida.", 400);
    const tipo = request.nextUrl.searchParams.get("tipo");
    if (tipo !== "VENTAS" && tipo !== "PREGUNTAS") throw new AppError("El tipo de cambios no es valido.", 400);
    const result = await query<{ revision: string }>(
      `SELECT COALESCE(MAX(procesado_at)::text, '') AS revision
       FROM public.mercadolibre_webhook_evento
       WHERE id_cuenta = $1 AND topic = $2 AND estado = 'PROCESADO'`,
      [idCuenta, tipo === "VENTAS" ? "orders_v2" : "questions"],
    );
    return NextResponse.json({ revision: result.rows[0].revision }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error, "No se pudieron consultar los cambios de Mercado Libre.");
  }
}
