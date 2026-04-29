import { NextRequest, NextResponse } from "next/server";
import { PiezaService } from "@/modules/piezas/services/pieza-service";
import { requireApiPermission } from "@/modules/auth/repos/api-auth";
import { jsonError } from "@/lib/api-errors";

export async function GET(request: NextRequest) {
  try {
    await requireApiPermission(request, "piezas.ver");
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page")) || 1;
    const limit = Number(searchParams.get("limit")) || 50;

    const result = await PiezaService.list(page, limit);
    return NextResponse.json(result);
  } catch (error: unknown) {
    return jsonError(error, "No se pudieron obtener las piezas");
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireApiPermission(request, "piezas.crear");
    const body = await request.json();
    const result = await PiezaService.create(body);

    return NextResponse.json({ ...result.pieza, warning: result.warning });
  } catch (error: unknown) {
    return jsonError(error, "No se pudo crear la pieza");
  }
}