import { NextRequest, NextResponse } from "next/server";
import { deleteCategoria, updateCategoria } from "@/lib/repos/catalogos";
import { requireApiWriteSession } from "@/modules/auth/repos/api-auth";
import { parseCatalogDescripcion, parseIdParam } from "@/lib/validators/catalogos";
import { jsonError } from "@/lib/api-errors";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireApiWriteSession(request);
  try {
    const { id } = await params;
    const numericId = parseIdParam(id);
    const body = await request.json();
    const payload = parseCatalogDescripcion(body);
    const result = await updateCategoria(numericId, payload.descripcion);
    return NextResponse.json(result);
  } catch (error: unknown) {
    return jsonError(error, "No se pudo actualizar la categoría");
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireApiWriteSession(request);
  try {
    const { id } = await params;
    const numericId = parseIdParam(id);
    await deleteCategoria(numericId);
    return NextResponse.json({ message: "Categoría eliminada correctamente" });
  } catch (error: unknown) {
    return jsonError(error, "No se pudo eliminar la categoría");
  }
}
