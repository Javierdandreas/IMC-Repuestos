import { NextRequest, NextResponse } from "next/server";
import { createCatalogo, createProveedorCompleto, getPaginatedCatalogo } from "@/lib/repos/catalogos";
import { requireApiWriteSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";

const ALLOWED_TABLES = ["marcas", "proveedores", "ubicaciones"];

type Params = Promise<{ table: string }>;

export async function GET(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const { table } = await params;
    
    if (!ALLOWED_TABLES.includes(table)) {
      return NextResponse.json({ message: "Catálogo no encontrado" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const search = searchParams.get("search") || undefined;

    const result = await getPaginatedCatalogo(table as any, page, limit, search);
    return NextResponse.json(result);
  } catch (error: any) {
    return jsonError(error, "No se pudo obtener el catálogo");
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    await requireApiWriteSession(request);
    const { table } = await params;

    if (!ALLOWED_TABLES.includes(table)) {
      return NextResponse.json({ message: "Catálogo no encontrado" }, { status: 404 });
    }

    const body = await request.json();
    const result = table === "proveedores"
      ? await createProveedorCompleto(body)
      : await createCatalogo(table as any, body.descripcion);
    return NextResponse.json(result);
  } catch (error: any) {
    return jsonError(error, "No se pudo crear el registro");
  }
}
