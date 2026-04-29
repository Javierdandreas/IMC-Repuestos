import { NextRequest, NextResponse } from "next/server";
import { createProducto, getProductosListado } from "@/modules/productos/repos/productos";
import { requireApiPermission } from "@/modules/auth/repos/api-auth";
import { validateProductoPayload } from "@/modules/productos/validators/productos";
import { jsonError } from "@/lib/api-errors";

export async function GET(request: NextRequest) {
  try {
    await requireApiPermission(request, "productos.ver");
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page")) || 1;
    const limit = Number(searchParams.get("limit")) || 50;

    const result = await getProductosListado(page, limit);
    return NextResponse.json(result);
  } catch (error: unknown) {
    return jsonError(error, "No se pudieron obtener los productos");
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireApiPermission(request, "productos.crear");
    const body = await request.json();
    const payload = validateProductoPayload(body);
    const newProduct = await createProducto(payload);
    return NextResponse.json(newProduct);
  } catch (error: unknown) {
    return jsonError(error, "No se pudo crear el producto");
  }
}