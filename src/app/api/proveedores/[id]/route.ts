import { NextRequest, NextResponse } from "next/server";
import { deleteProveedor, updateProveedor } from "@/lib/repos/catalogos";
import { requireApiSession } from "@/lib/api-auth";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const result = await updateProveedor(id, body.descripcion);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "No se pudo actualizar el proveedor" }, { status: error.status || 400 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await deleteProveedor(id);
    return NextResponse.json({ message: "Proveedor eliminado correctamente" });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "No se pudo eliminar el proveedor" }, { status: error.status || 400 });
  }
}