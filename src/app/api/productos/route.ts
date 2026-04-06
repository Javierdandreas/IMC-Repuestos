import { NextRequest, NextResponse } from "next/server";
import { createProducto, getProductosListado } from "@/lib/repos/productos";
import { requireApiSession } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  await requireApiSession(request);
  try {
    const rows = await getProductosListado();
    return NextResponse.json(rows);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  await requireApiSession(request);
  try {
    const body = await request.json();
    const newProduct = await createProducto(body);
    return NextResponse.json(newProduct);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: error.status || 400 });
  }
}