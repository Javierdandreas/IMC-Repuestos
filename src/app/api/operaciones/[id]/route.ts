import { NextRequest, NextResponse } from "next/server";
import { getOperacionById } from "@/lib/repos/operaciones";
import { requireApiSession } from "@/lib/api-auth";
import { parseIdParam } from "@/lib/validators/catalogos";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireApiSession(request);
    
    const { id } = await params;
    const numericId = parseIdParam(id);

    const data = await getOperacionById(numericId);
    
    if (!data) {
        return NextResponse.json({ message: "Operación no encontrada" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Error al obtener operación" }, { status: 500 });
  }
}
