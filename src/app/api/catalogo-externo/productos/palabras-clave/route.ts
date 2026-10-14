import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api-errors";
import { requireApiWriteSession } from "@/lib/api-auth";
import { updateExternalCatalogExistingKeywords } from "@/lib/catalogo-externo";

const requestSchema = z.object({
  snapshotId: z.number().int().positive(),
});

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    await requireApiWriteSession(request);
    const { snapshotId } = requestSchema.parse(await request.json());
    return NextResponse.json(await updateExternalCatalogExistingKeywords(snapshotId));
  } catch (error: unknown) {
    return jsonError(error, "No se pudieron actualizar las palabras clave existentes.");
  }
}
