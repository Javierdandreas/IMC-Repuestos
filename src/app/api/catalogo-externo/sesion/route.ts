import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api-errors";
import { requireApiWriteSession } from "@/lib/api-auth";
import { discardExternalCatalogSnapshot } from "@/lib/catalogo-externo";

const querySchema = z.object({ snapshot: z.coerce.number().int().positive() });

export async function DELETE(request: NextRequest) {
  try {
    await requireApiWriteSession(request);
    const { snapshot } = querySchema.parse({ snapshot: request.nextUrl.searchParams.get("snapshot") });
    return NextResponse.json(await discardExternalCatalogSnapshot(snapshot));
  } catch (error: unknown) {
    return jsonError(error, "No se pudo finalizar la consulta externa.");
  }
}
