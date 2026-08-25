import { NextRequest, NextResponse } from "next/server";
import { getOperaciones, createOperacion } from "@/lib/repos/operaciones";
import { requireApiSession, requireApiWriteSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get("tipo") as "COMPRA" | "VENTA" | "AJUSTE" | null;

    const session = await requireApiSession(request);
    
    const data = await getOperaciones({ tipo: tipo || undefined });
    return NextResponse.json(data);
  } catch (error: any) {
    return jsonError(error, "Error al obtener operaciones");
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiWriteSession(request);
    const body = await request.json();

    // Basic Validation
    if (!body.tipo || !['COMPRA', 'VENTA', 'AJUSTE'].includes(body.tipo.toUpperCase())) {
      return NextResponse.json({ message: "Tipo de operación inválido." }, { status: 400 });
    }
    if (!body.detalles || body.detalles.length === 0) {
      return NextResponse.json({ message: "La operación debe incluir al menos un detalle." }, { status: 400 });
    }

    const payload = {
        ...body,
        tipo: body.tipo.toUpperCase(),
        usuario_id: session.usuarioId,
    };

    const newId = await createOperacion(payload);

    return NextResponse.json({ id: newId, message: "Operación creada exitosamente." }, { status: 201 });
  } catch (error: any) {
    return jsonError(error, "Error interno al crear operación");
  }
}
