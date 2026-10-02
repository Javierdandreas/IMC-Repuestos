import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api-errors";
import { requireApiWriteSession } from "@/lib/api-auth";
import { finalizeManualExternalCatalogUpload } from "@/lib/catalogo-externo";

const requestSchema = z.object({
  uploadId: z.string().min(16).max(80),
});

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    await requireApiWriteSession(request);
    const body = requestSchema.parse(await request.json());
    return NextResponse.json(await finalizeManualExternalCatalogUpload(body.uploadId));
  } catch (error: unknown) {
    return jsonError(error, "No se pudo preparar la revision manual del catalogo.");
  }
}
