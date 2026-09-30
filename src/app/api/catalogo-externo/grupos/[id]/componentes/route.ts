import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api-errors";
import { requireApiWriteSession } from "@/lib/api-auth";
import { saveExternalCatalogGroupComponents } from "@/lib/catalogo-externo";

const requestSchema = z.object({
  snapshotId: z.number().int().positive(),
  components: z.array(z.object({
    code: z.string().trim().min(1).max(120),
    quantity: z.number().int().positive(),
  })).min(1).max(100),
});

type Params = Promise<{ id: string }>;

export async function PUT(request: NextRequest, { params }: { params: Params }) {
  try {
    const session = await requireApiWriteSession(request);
    const { id } = await params;
    const itemId = Number(id);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return NextResponse.json({ message: "Grupo externo invalido." }, { status: 400 });
    }
    const body = requestSchema.parse(await request.json());
    return NextResponse.json(await saveExternalCatalogGroupComponents(body.snapshotId, itemId, body.components, session.usuarioId));
  } catch (error: unknown) {
    return jsonError(error, "No se pudieron guardar los componentes del kit.");
  }
}
