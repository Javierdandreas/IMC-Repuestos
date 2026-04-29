import { NextRequest, NextResponse } from "next/server";
import { SubcategoriaService } from "@/modules/subcategorias/services/subcategoria-service";
import { requireApiPermission } from "@/modules/auth/repos/api-auth";
import { jsonError } from "@/lib/api-errors";

export async function GET(request: NextRequest) {
  try {
    await requireApiPermission(request, "subcategorias.ver");
    const rows = await SubcategoriaService.list();
    return NextResponse.json(rows);
  } catch (error: unknown) {
    return jsonError(error, "No se pudieron obtener las subcategorías");
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireApiPermission(request, "subcategorias.crear");
    const body = await request.json();
    const result = await SubcategoriaService.create(body);
    return NextResponse.json(result);
  } catch (error: unknown) {
    return jsonError(error, "No se pudo crear la subcategoría");
  }
}