import { NextRequest, NextResponse } from "next/server";
import { createSubcategoria, getSubcategoriasConCategoria } from "@/lib/repos/catalogos";
import { requireApiSession, requireApiWriteSession } from "@/lib/api-auth";
import { parseSubcategoriaPayload } from "@/lib/validators/catalogos";
import { jsonError } from "@/lib/api-errors";

export async function GET(request: NextRequest) {
  await requireApiSession(request);
  try {
    const rows = await getSubcategoriasConCategoria();
    return NextResponse.json(rows);
  } catch (error: unknown) {
    return jsonError(error, "No se pudieron obtener las subcategorías");
  }
}

export async function POST(request: NextRequest) {
  await requireApiWriteSession(request);
  try {
    const body = await request.json();
    const payload = parseSubcategoriaPayload(body);
    const result = await createSubcategoria(payload.descripcion, payload.id_categoria);
    return NextResponse.json(result);
  } catch (error: unknown) {
    return jsonError(error, "No se pudo crear la subcategoría");
  }
}