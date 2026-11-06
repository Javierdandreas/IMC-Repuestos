import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-errors";
import { requireApiWriteSession } from "@/lib/api-auth";
import { updateCliente } from "@/lib/repos/clientes";

type Params = Promise<{ id: string }>;

export async function PUT(request: NextRequest, { params }: { params: Params }) {
  try {
    await requireApiWriteSession(request);
    const { id } = await params;
    const idCliente = Number(id);
    if (!Number.isInteger(idCliente) || idCliente <= 0) return NextResponse.json({ message: "Cliente invalido." }, { status: 400 });
    return NextResponse.json(await updateCliente(idCliente, await request.json()));
  } catch (error) {
    return jsonError(error, "No se pudo actualizar el cliente.");
  }
}
