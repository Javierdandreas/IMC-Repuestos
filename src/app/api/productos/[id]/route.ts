import { NextRequest, NextResponse } from "next/server";
import { deleteProducto, getProductoById, updateProducto } from "@/lib/repos/productos";
import { requireApiSession, requireApiWriteSession } from "@/lib/api-auth";
import { validateProductoPayload } from "@/lib/validators/productos";
import { parseIdParam } from "@/lib/validators/catalogos";
import { jsonError } from "@/lib/api-errors";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireApiSession(request);
  try {
    const { id } = await params;
    const numericId = parseIdParam(id);
    const product = await getProductoById(numericId);

    if (!product) {
      return NextResponse.json({ message: "Producto no encontrado" }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error: unknown) {
    return jsonError(error, "No se pudo obtener el producto");
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireApiWriteSession(request);
  try {
    const { id } = await params;
    const numericId = parseIdParam(id);
    const body = await request.json();
    const payload = validateProductoPayload(body);
    const product = await updateProducto(numericId, payload);
    return NextResponse.json(product);
  } catch (error: unknown) {
    return jsonError(error, "No se pudo actualizar el producto");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireApiWriteSession(request);
  try {
    const { id } = await params;
    const numericId = parseIdParam(id);
    await deleteProducto(numericId);
    return NextResponse.json({ message: "Producto eliminado correctamente" });
  } catch (error: unknown) {
    return jsonError(error, "No se pudo eliminar el producto");
  }
}