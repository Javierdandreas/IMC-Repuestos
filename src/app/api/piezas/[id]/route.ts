import { NextRequest, NextResponse } from "next/server";
import { deletePieza, getPiezaById, updatePieza } from "@/lib/repos/piezas";
import { requireApiSession } from "@/lib/api-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireApiSession(request);
  try {
    const { id } = await params;
    const pieza = await getPiezaById(id);

    if (!pieza) {
      return NextResponse.json({ message: "Pieza no encontrada" }, { status: 404 });
    }

    return NextResponse.json(pieza);
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || "No se pudo obtener la pieza" },
      { status: error.status || 400 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireApiSession(request);
  try {
    const { id } = await params;
    const body = await request.json();

    const result = await updatePieza(id, {
      codigo_pieza: String(body.codigo_pieza ?? ""),
      descripcion: String(body.descripcion ?? ""),
      medida: String(body.medida ?? ""),
      id_subcategoria: Number(body.id_subcategoria),
      originales: Array.isArray(body.originales) ? body.originales : [],
      equivalentes: Array.isArray(body.equivalentes) ? body.equivalentes : [],
    });

    return NextResponse.json({ ...result.pieza, warning: result.warning });
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || "No se pudo actualizar la pieza" },
      { status: error.status || 400 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireApiSession(request);
  try {
    const { id } = await params;
    await deletePieza(id);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || "No se pudo borrar la pieza" },
      { status: error.status || 400 }
    );
  }
}