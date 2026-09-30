import { NextRequest, NextResponse } from "next/server";
import { AppError, jsonError } from "@/lib/api-errors";
import { requireApiWriteSession } from "@/lib/api-auth";
import { getExternalCatalogGroups } from "@/lib/catalogo-externo";

export const dynamic = "force-dynamic";

function positiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: NextRequest) {
  try {
    await requireApiWriteSession(request);
    const { searchParams } = new URL(request.url);
    const snapshotId = positiveInteger(searchParams.get("snapshot"), 0);
    if (!snapshotId) throw new AppError("Falta la revision externa solicitada.", 400);
    const statusValue = searchParams.get("estado") || "";
    const status = statusValue === "LISTO" || statusValue === "REVISAR" ? statusValue : undefined;
    const data = await getExternalCatalogGroups(
      snapshotId,
      positiveInteger(searchParams.get("page"), 1),
      positiveInteger(searchParams.get("limit"), 50),
      searchParams.get("search") || undefined,
      status
    );
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error: unknown) {
    return jsonError(error, "No se pudieron obtener los grupos externos.");
  }
}
