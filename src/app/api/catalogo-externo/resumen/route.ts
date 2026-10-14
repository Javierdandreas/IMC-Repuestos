import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-errors";
import { requireApiWriteSession } from "@/lib/api-auth";
import { refreshExternalCatalogPreview } from "@/lib/catalogo-externo";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  try {
    await requireApiWriteSession(request);
    const preview = await refreshExternalCatalogPreview();
    return NextResponse.json(preview, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error: unknown) {
    return jsonError(error, "No se pudo consultar el catalogo externo.");
  }
}
