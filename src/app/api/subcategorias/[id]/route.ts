import { NextRequest, NextResponse } from "next/server";
import { deleteSubcategoria, updateSubcategoria } from "@/lib/repos/catalogos";
import { requireApiWriteSession } from "@/modules/auth/repos/api-auth";
import { parseSubcategoriaPayload, parseIdParam } from "@/lib/validators/catalogos";
import { jsonError } from "@/lib/api-errors";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireApiWriteSession(request);
  try {
    const { id } = await params;
    const numericId = parseIdParam(id);
    const body = await request.json();
    const payload = parseSubcategoriaPayload(body);
    const result = await updateSubcategoria(numericId, payload.descripcion, payload.id_categoria);
    return NextResponse.json(result);
  } catch (error: unknown) {
    return jsonError(error, "No se pudo actualizar la subcategoría");
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireApiWriteSession(request);
  try {
    const { id } = await params;
    const numericId = parseIdParam(id);
    await deleteSubcategoria(numericId);
    return NextResponse.json({ message: "Subcategoría eliminada correctamente" });
  } catch (error: unknown) {
    return jsonError(error, "No se pudo eliminar la subcategoría");
  }
}
