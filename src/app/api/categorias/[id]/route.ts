import { NextRequest, NextResponse } from "next/server";
import { deleteCategoria, updateCategoria } from "@/lib/repos/catalogos";
import { requireApiSession } from "@/lib/api-auth";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const result = await updateCategoria(id, body.descripcion);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "No se pudo actualizar la categoría" }, { status: error.status || 400 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await deleteCategoria(id);
    return NextResponse.json({ message: "Categoría eliminada correctamente" });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "No se pudo eliminar la categoría" }, { status: error.status || 400 });
  }
}