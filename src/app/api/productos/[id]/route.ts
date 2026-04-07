import { NextRequest, NextResponse } from "next/server";
import { deleteProducto, getProductoById, updateProducto } from "@/lib/repos/productos";
import { requireApiSession } from "@/lib/api-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireApiSession(request);
  try {
    const { id } = await params;
    const product = await getProductoById(id);

    if (!product) {
      return NextResponse.json({ message: "Producto no encontrado" }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireApiSession(request);
  try {
    const { id } = await params;
    const body = await request.json();
    const product = await updateProducto(id, body);
    return NextResponse.json(product);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: error.status || 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireApiSession(request);
  try {
    const { id } = await params;
    await deleteProducto(id);
    return NextResponse.json({ message: "Producto eliminado correctamente" });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: error.status || 400 });
  }
}