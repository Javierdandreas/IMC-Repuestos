import { NextRequest, NextResponse } from "next/server";
import { createSubcategoria, getSubcategoriasConCategoria } from "@/lib/repos/catalogos";
import { requireApiSession } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  await requireApiSession(request);
  try {
    const rows = await getSubcategoriasConCategoria();
    return NextResponse.json(rows);
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "No se pudieron obtener las subcategorías" }, { status: error.status || 400 });
  }
}

export async function POST(request: NextRequest) {
  await requireApiSession(request);
  try {
    const body = await request.json();
    const result = await createSubcategoria(body.descripcion, body.id_categoria);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "No se pudo crear la subcategoría" }, { status: error.status || 400 });
  }
}