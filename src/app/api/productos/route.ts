import { NextRequest, NextResponse } from "next/server";
import { createProducto, getProductosListado } from "@/lib/repos/productos";
import { requireApiSession, requireApiWriteSession } from "@/lib/api-auth";
import { validateProductoPayload } from "@/lib/validators/productos";
import { jsonError } from "@/lib/api-errors";

export async function GET(request: NextRequest) {
  await requireApiSession(request);
  try {
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page")) || 1;
    const limit = Number(searchParams.get("limit")) || 50;
    const search = searchParams.get("search") || undefined;
    const searchSpecific = searchParams.get("searchSpecific") || undefined;

    const result = await getProductosListado(page, limit, { search, searchSpecific });
    return NextResponse.json(result);
  } catch (error: unknown) {
    return jsonError(error, "No se pudieron obtener los items");
  }
}

export async function POST(request: NextRequest) {
  await requireApiWriteSession(request);
  try {
    const body = await request.json();
    const payload = validateProductoPayload(body);
    const newProduct = await createProducto(payload);
    return NextResponse.json(newProduct);
  } catch (error: unknown) {
    return jsonError(error, "No se pudo crear el item");
  }
}
