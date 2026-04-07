import { NextRequest, NextResponse } from "next/server";
import { getCategoriasTree } from "@/lib/repos/catalogos";
import { requireApiSession } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  await requireApiSession(request);
  try {
    const rows = await getCategoriasTree();
    return NextResponse.json(rows);
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "No se pudo obtener el árbol de categorías" }, { status: error.status || 400 });
  }
}