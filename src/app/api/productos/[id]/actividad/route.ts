import { NextRequest, NextResponse } from "next/server";
import { requireApiWriteSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";
import { parseIdParam } from "@/lib/validators/catalogos";
import { getProductoActividad } from "@/lib/repos/producto-actividad";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireApiWriteSession(request);
    const { id } = await params;
    const activities = await getProductoActividad(parseIdParam(id));
    return NextResponse.json({ activities });
  } catch (error: unknown) {
    return jsonError(error, "No se pudo obtener la actividad del item");
  }
}
