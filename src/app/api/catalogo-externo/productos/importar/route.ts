import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api-errors";
import { requireApiWriteSession } from "@/lib/api-auth";
import { importExternalCatalogProducts } from "@/lib/catalogo-externo";

const requestSchema = z.object({
  snapshotId: z.number().int().positive(),
  itemIds: z.array(z.number().int().positive()).min(1).max(500),
});

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiWriteSession(request);
    const body = requestSchema.parse(await request.json());
    const result = await importExternalCatalogProducts(body.snapshotId, body.itemIds, session.usuarioId);
    return NextResponse.json(result);
  } catch (error: unknown) {
    return jsonError(error, "No se pudieron importar los productos seleccionados.");
  }
}
