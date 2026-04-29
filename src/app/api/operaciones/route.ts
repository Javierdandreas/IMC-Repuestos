import { NextRequest, NextResponse } from "next/server";
import { OperacionService } from "@/modules/operaciones/services/operacion-service";
import { requireApiPermission } from "@/modules/auth/repos/api-auth";
import { jsonError } from "@/lib/api-errors";

export async function GET(request: NextRequest) {
  try {
    await requireApiPermission(request, "operaciones.ver");
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get("tipo") as "COMPRA" | "VENTA" | "AJUSTE" | null;

    const data = await OperacionService.listOperaciones({ tipo: tipo || undefined });
    return NextResponse.json(data);
  } catch (error: any) {
    return jsonError(error, "Error al obtener operaciones");
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiPermission(request, "operaciones.crear");
    const body = await request.json();

    const result = await OperacionService.create(body, session.usuarioId);

    return NextResponse.json({ id: result, message: "Operación creada exitosamente." }, { status: 201 });
  } catch (error: any) {
    return jsonError(error, "Error al crear la operación");
  }
}
