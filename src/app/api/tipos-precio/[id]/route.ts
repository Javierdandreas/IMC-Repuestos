import { NextRequest, NextResponse } from "next/server";
import { requireApiWriteSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";
import { deleteTipoPrecioConfig } from "@/lib/repos/catalogos";

type Params = Promise<{ id: string }>;

export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  try {
    await requireApiWriteSession(request);
    const { id } = await params;
    await deleteTipoPrecioConfig(id);
    return NextResponse.json({ message: "Lista de precio eliminada" });
  } catch (error) {
    return jsonError(error, "No se pudo eliminar la lista de precio");
  }
}
