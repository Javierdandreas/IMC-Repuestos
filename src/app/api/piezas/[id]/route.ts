import { NextRequest, NextResponse } from "next/server";
import { deletePieza, getPiezaById, updatePieza } from "@/lib/repos/piezas";
import { requireApiSession, requireApiWriteSession } from "@/lib/api-auth";
import { validatePiezaPayload } from "@/lib/validators/piezas";
import { parseIdParam } from "@/lib/validators/catalogos";
import { jsonError } from "@/lib/api-errors";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireApiSession(request);
  try {
    const { id } = await params;
    const numericId = parseIdParam(id);
    const pieza = await getPiezaById(numericId);

    if (!pieza) {
      return NextResponse.json({ message: "Pieza no encontrada" }, { status: 404 });
    }

    return NextResponse.json(pieza);
  } catch (error: unknown) {
    return jsonError(error, "No se pudo obtener la pieza");
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireApiWriteSession(request);
  try {
    const { id } = await params;
    const numericId = parseIdParam(id);
    const body = await request.json();
    const payload = validatePiezaPayload(body);

    const result = await updatePieza(numericId, payload);

    return NextResponse.json({ ...result.pieza, warning: result.warning });
  } catch (error: unknown) {
    return jsonError(error, "No se pudo actualizar la pieza");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireApiWriteSession(request);
  try {
    const { id } = await params;
    const numericId = parseIdParam(id);
    await deletePieza(numericId);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return jsonError(error, "No se pudo borrar la pieza");
  }
}