import { NextRequest, NextResponse } from "next/server";
import { updateCatalogo, deleteCatalogo } from "@/lib/repos/catalogos";
import { requireApiWriteSession } from "@/modules/auth/repos/api-auth";
import { jsonError, AppError } from "@/lib/api-errors";

const ALLOWED_TABLES = ["marcas", "proveedores", "ubicaciones"];

type Params = Promise<{ table: string; id: string }>;

export async function PUT(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    await requireApiWriteSession(request);
    const { table, id } = await params;

    if (!ALLOWED_TABLES.includes(table)) {
      return NextResponse.json({ message: "Catálogo no encontrado" }, { status: 404 });
    }

    const { descripcion } = await request.json();
    const result = await updateCatalogo(table as any, id, descripcion);
    return NextResponse.json(result);
  } catch (error: any) {
    return jsonError(error, "No se pudo actualizar el registro");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    await requireApiWriteSession(request);
    const { table, id } = await params;

    if (!ALLOWED_TABLES.includes(table)) {
      return NextResponse.json({ message: "Catálogo no encontrado" }, { status: 404 });
    }

    await deleteCatalogo(table as any, id);
    return NextResponse.json({ message: "Eliminado correctamente" });
  } catch (error: any) {
    return jsonError(error, "No se pudo eliminar el registro");
  }
}
