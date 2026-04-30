import { NextRequest, NextResponse } from "next/server";
import { requireApiWriteSession } from "@/modules/auth/repos/api-auth";
import { generateAutoSeriesForProduct } from "@/modules/series/repos/series";
import { jsonError } from "@/lib/api-errors";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireApiWriteSession(request);
  try {
    const resolvedParams = await params;
    const idProducto = Number(resolvedParams.id);

    if (isNaN(idProducto) || idProducto <= 0) {
      return NextResponse.json({ message: "ID de producto inválido" }, { status: 400 });
    }

    const nuevasSeries = await generateAutoSeriesForProduct(idProducto, session.usuarioId);

    return NextResponse.json(nuevasSeries, { status: 201 });
  } catch (error: unknown) {
    return jsonError(error, "No se pudieron autogenerar las series para el producto");
  }
}
