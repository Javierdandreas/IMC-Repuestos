import { NextRequest, NextResponse } from "next/server";
import { getKitById, updateKit, deleteKit } from "@/lib/repos/kits";
import { requireApiSession, requireApiWriteSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireApiSession(request);
  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr);

    const kit = await getKitById(id);
    if (!kit) {
      return NextResponse.json({ error: "Kit no encontrado" }, { status: 404 });
    }
    return NextResponse.json(kit);
  } catch (error: unknown) {
    return jsonError(error, "No se pudo obtener el kit");
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireApiWriteSession(request);
  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr);

    const body = await request.json();
    const updatedKit = await updateKit(id, body);
    return NextResponse.json(updatedKit);
  } catch (error: unknown) {
    return jsonError(error, "No se pudo actualizar el kit");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireApiWriteSession(request);
  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr);

    await deleteKit(id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return jsonError(error, "No se pudo eliminar el kit");
  }
}
