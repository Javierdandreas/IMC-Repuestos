import { NextRequest, NextResponse } from "next/server";
import { CategoriaService } from "@/modules/categorias/services/categoria-service";
import { requireApiPermission } from "@/modules/auth/repos/api-auth";
import { jsonError } from "@/lib/api-errors";

export async function GET(request: NextRequest) {
  try {
    await requireApiPermission(request, "categorias.ver");
    const rows = await CategoriaService.list();
    return NextResponse.json(rows);
  } catch (error: unknown) {
    return jsonError(error, "No se pudieron obtener las categorías");
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireApiPermission(request, "categorias.crear");
    const body = await request.json();
    const result = await CategoriaService.create(body);
    return NextResponse.json(result);
  } catch (error: unknown) {
    return jsonError(error, "No se pudo crear la categoría");
  }
}