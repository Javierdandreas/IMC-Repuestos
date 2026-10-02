import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api-errors";
import { requireApiWriteSession } from "@/lib/api-auth";
import { saveManualExternalCatalogBatch } from "@/lib/catalogo-externo";

const requestSchema = z.object({
  uploadId: z.string().min(16).max(80),
  offset: z.number().int().nonnegative(),
  rows: z.array(z.record(z.string(), z.unknown())).min(1).max(250),
});

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    await requireApiWriteSession(request);
    const body = requestSchema.parse(await request.json());
    await saveManualExternalCatalogBatch(body.uploadId, body.offset, body.rows);
    return NextResponse.json({ ok: true, processed: body.rows.length });
  } catch (error: unknown) {
    return jsonError(error, "No se pudo guardar el lote del catalogo manual.");
  }
}
