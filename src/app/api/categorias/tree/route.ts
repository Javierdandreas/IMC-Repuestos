import { NextRequest, NextResponse } from "next/server";
import { getCategoriasTree } from "@/lib/repos/catalogos";
import { requireApiSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";

export async function GET(request: NextRequest) {
  await requireApiSession(request);
  try {
    const rows = await getCategoriasTree();
    return NextResponse.json(rows);
  } catch (error: unknown) {
    return jsonError(error, "No se pudo obtener el árbol de categorías");
  }
}