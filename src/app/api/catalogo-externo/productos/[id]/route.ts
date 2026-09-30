import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api-errors";
import { requireApiWriteSession } from "@/lib/api-auth";
import { classifyExternalCatalogProduct } from "@/lib/catalogo-externo";

const requestSchema = z.object({
  snapshotId: z.number().int().positive(),
  categoryId: z.number().int().positive(),
  subcategoryId: z.number().int().positive(),
});

type Params = Promise<{ id: string }>;

export async function PUT(request: NextRequest, { params }: { params: Params }) {
  try {
    const session = await requireApiWriteSession(request);
    const { id } = await params;
    const itemId = Number(id);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return NextResponse.json({ message: "Producto externo invalido." }, { status: 400 });
    }
    const body = requestSchema.parse(await request.json());
    const result = await classifyExternalCatalogProduct(
      body.snapshotId,
      itemId,
      body.categoryId,
      body.subcategoryId,
      session.usuarioId
    );
    return NextResponse.json(result);
  } catch (error: unknown) {
    return jsonError(error, "No se pudo clasificar el producto externo.");
  }
}
