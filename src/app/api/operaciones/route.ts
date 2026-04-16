import { NextRequest, NextResponse } from "next/server";
import { getOperaciones, createOperacion } from "@/lib/repos/operaciones";
import { requireApiSession } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get("tipo") as "COMPRA" | "VENTA" | null;

    const session = await requireApiSession(request);
    
    const data = await getOperaciones({ tipo: tipo || undefined });
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Error al obtener operaciones" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiSession(request);
    const body = await request.json();

    // Basic Validation
    if (!body.tipo || !['COMPRA', 'VENTA'].includes(body.tipo.toUpperCase())) {
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
    return NextResponse.json({ message: error.message || "Error interno al crear operación" }, { status: 500 });
  }
}
