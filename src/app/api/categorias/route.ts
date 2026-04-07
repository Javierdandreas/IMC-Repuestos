import { NextRequest, NextResponse } from "next/server";
import { createCategoria, getCategorias } from "@/lib/repos/catalogos";
import { requireApiSession, requireApiWriteSession } from "@/lib/api-auth";
import { parseCatalogDescripcion } from "@/lib/validators/catalogos";
import { jsonError } from "@/lib/api-errors";

export async function GET(request: NextRequest) {
  await requireApiSession(request);
  try {
    const rows = await getCategorias();
    return NextResponse.json(rows);
  } catch (error: unknown) {
    return jsonError(error, "No se pudieron obtener las categorías");
  }
}

export async function POST(request: NextRequest) {
  await requireApiWriteSession(request);
  try {
    const body = await request.json();
    const payload = parseCatalogDescripcion(body);
    const result = await createCategoria(payload.descripcion);
    return NextResponse.json(result);
  } catch (error: unknown) {
    return jsonError(error, "No se pudo crear la categoría");
  }
}