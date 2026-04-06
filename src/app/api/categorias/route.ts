import { NextRequest, NextResponse } from "next/server";
import { createCategoria, getCategorias } from "@/lib/repos/catalogos";
import { requireApiSession } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  await requireApiSession(request);
  try {
    const rows = await getCategorias();
    return NextResponse.json(rows);
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "No se pudieron obtener las categorías" }, { status: error.status || 400 });
  }
}

export async function POST(request: NextRequest) {
  await requireApiSession(request);
  try {
    const body = await request.json();
    const result = await createCategoria(body.descripcion);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "No se pudo crear la categoría" }, { status: error.status || 400 });
  }
}