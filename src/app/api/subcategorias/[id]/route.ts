import { NextRequest, NextResponse } from "next/server";
import { deleteSubcategoria, updateSubcategoria } from "@/lib/repos/catalogos";
import { requireApiSession } from "@/lib/api-auth";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireApiSession(request);
  try {
    const { id } = await params;
    const body = await request.json();
    const result = await updateSubcategoria(id, body.descripcion, body.id_categoria);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "No se pudo actualizar la subcategoría" }, { status: error.status || 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireApiSession(request);
  try {
    const { id } = await params;
    await deleteSubcategoria(id);
    return NextResponse.json({ message: "Subcategoría eliminada correctamente" });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "No se pudo eliminar la subcategoría" }, { status: error.status || 400 });
  }
}