import { NextRequest, NextResponse } from "next/server";
import { createProducto, getProductosListado } from "@/lib/repos/productos";
import { requireApiSession, requireApiWriteSession } from "@/lib/api-auth";
import { validateProductoPayload } from "@/lib/validators/productos";
import { jsonError } from "@/lib/api-errors";

export async function GET(request: NextRequest) {
  await requireApiSession(request);
  try {
    const rows = await getProductosListado();
    return NextResponse.json(rows);
  } catch (error: unknown) {
    return jsonError(error, "No se pudieron obtener los productos");
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
    return jsonError(error, "No se pudo crear el producto");
  }
}