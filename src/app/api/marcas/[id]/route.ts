import { NextRequest, NextResponse } from "next/server";
import { deleteMarca, updateMarca } from "@/lib/repos/catalogos";
import { requireApiSession } from "@/lib/api-auth";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const result = await updateMarca(id, body.descripcion);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "No se pudo actualizar la marca" }, { status: error.status || 400 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await deleteMarca(id);
    return NextResponse.json({ message: "Marca eliminada correctamente" });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "No se pudo eliminar la marca" }, { status: error.status || 400 });
  }
}