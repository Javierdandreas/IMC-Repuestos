import { NextRequest, NextResponse } from "next/server";
import { deleteUbicacion, updateUbicacion } from "@/lib/repos/catalogos";
import { requireApiWriteSession } from "@/lib/api-auth";
import { parseCatalogDescripcion, parseIdParam } from "@/lib/validators/catalogos";
import { jsonError } from "@/lib/api-errors";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireApiWriteSession(request);
    const { id } = await params;
    const numericId = parseIdParam(id);
    const body = await request.json();
    const payload = parseCatalogDescripcion(body);
    const result = await updateUbicacion(numericId, payload.descripcion);
    return NextResponse.json(result);
  } catch (error: unknown) {
    return jsonError(error, "No se pudo actualizar la ubicación");
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireApiWriteSession(request);
    const { id } = await params;
    const numericId = parseIdParam(id);
    await deleteUbicacion(numericId);
    return NextResponse.json({ message: "Ubicación eliminada correctamente" });
  } catch (error: unknown) {
    return jsonError(error, "No se pudo eliminar la ubicación");
  }
}
