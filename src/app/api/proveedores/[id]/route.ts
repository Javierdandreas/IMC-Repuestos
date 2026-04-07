import { NextRequest, NextResponse } from "next/server";
import { deleteProveedor, updateProveedor } from "@/lib/repos/catalogos";
import { requireApiWriteSession } from "@/lib/api-auth";
import { parseCatalogDescripcion, parseIdParam } from "@/lib/validators/catalogos";
import { jsonError } from "@/lib/api-errors";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireApiWriteSession(request);
  try {
    const { id } = await params;
    const numericId = parseIdParam(id);
    const body = await request.json();
    const payload = parseCatalogDescripcion(body);
    const result = await updateProveedor(numericId, payload.descripcion);
    return NextResponse.json(result);
  } catch (error: unknown) {
    return jsonError(error, "No se pudo actualizar el proveedor");
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireApiWriteSession(request);
  try {
    const { id } = await params;
    const numericId = parseIdParam(id);
    await deleteProveedor(numericId);
    return NextResponse.json({ message: "Proveedor eliminado correctamente" });
  } catch (error: unknown) {
    return jsonError(error, "No se pudo eliminar el proveedor");
  }
}