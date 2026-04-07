import { NextRequest, NextResponse } from "next/server";
import { deleteMarca, updateMarca } from "@/lib/repos/catalogos";
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
    const result = await updateMarca(numericId, payload.descripcion);
    return NextResponse.json(result);
  } catch (error: unknown) {
    return jsonError(error, "No se pudo actualizar la marca");
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireApiWriteSession(request);
  try {
    const { id } = await params;
    const numericId = parseIdParam(id);
    await deleteMarca(numericId);
    return NextResponse.json({ message: "Marca eliminada correctamente" });
  } catch (error: unknown) {
    return jsonError(error, "No se pudo eliminar la marca");
  }
}