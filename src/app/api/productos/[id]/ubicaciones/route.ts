import { NextRequest, NextResponse } from "next/server";
import { requireApiSession, requireApiWriteSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";
import {
  getProductoUbicaciones,
  syncProductoStockUbicaciones,
  updateProductoSeriesUbicaciones,
} from "@/lib/repos/producto-ubicaciones";
import { parseIdParam } from "@/lib/validators/catalogos";

type Params = Promise<{ id: string }>;

export async function GET(
  request: NextRequest,
  { params }: { params: Params }
) {
  await requireApiSession(request);
  try {
    const { id } = await params;
    const idProducto = parseIdParam(id);
    const result = await getProductoUbicaciones(idProducto);
    return NextResponse.json(result);
  } catch (error: unknown) {
    return jsonError(error, "No se pudieron obtener las ubicaciones del item");
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Params }
) {
  const session = await requireApiWriteSession(request);
  try {
    const { id } = await params;
    const idProducto = parseIdParam(id);
    const body = await request.json();

    if (body?.mode === "series") {
      await updateProductoSeriesUbicaciones(idProducto, body.series ?? [], session.usuarioId);
    } else if (body?.mode === "stock") {
      await syncProductoStockUbicaciones(idProducto, body.stock_ubicaciones ?? []);
    } else {
      return NextResponse.json({ message: "Tipo de actualización inválido" }, { status: 400 });
    }

    const result = await getProductoUbicaciones(idProducto);
    return NextResponse.json(result);
  } catch (error: unknown) {
    return jsonError(error, "No se pudieron guardar las ubicaciones del item");
  }
}
