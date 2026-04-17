import { NextRequest, NextResponse } from "next/server";
import { getAvailableSerialsByProduct } from "@/lib/repos/productos";
import { requireApiSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireApiSession(request);
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json({ message: "ID de producto requerido" }, { status: 400 });
    }

    const serials = await getAvailableSerialsByProduct(id);
    return NextResponse.json(serials);
  } catch (error: any) {
    return jsonError(error, "Error al obtener series disponibles");
  }
}
