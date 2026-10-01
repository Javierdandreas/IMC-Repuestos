import { NextRequest, NextResponse } from "next/server";
import { requireApiReadSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";
import { getPreciosModificadosProveedor } from "@/lib/repos/proveedor-importaciones";

function positiveInteger(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function approvalStatus(value: string | null) {
  return ["TODOS", "PENDIENTE", "APROBADOS", "RECHAZADO", "REEMPLAZADO"].includes(value ?? "")
    ? value as "TODOS" | "PENDIENTE" | "APROBADOS" | "RECHAZADO" | "REEMPLAZADO"
    : undefined;
}

export async function GET(request: NextRequest) {
  try {
    await requireApiReadSession(request);
    const { searchParams } = new URL(request.url);
    const result = await getPreciosModificadosProveedor({
      idProveedor: positiveInteger(searchParams.get("proveedor")),
      idImportacion: positiveInteger(searchParams.get("importacion")),
      estado: approvalStatus(searchParams.get("estado")),
      page: positiveInteger(searchParams.get("page")) ?? 1,
      limit: positiveInteger(searchParams.get("limit")) ?? 50,
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error: unknown) {
    return jsonError(error, "No se pudieron obtener los costos modificados.");
  }
}
