import { NextRequest, NextResponse } from "next/server";
import { requireApiWriteSession, requireApiSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";
import { getProveedorDiscounts, updateProveedorDiscounts } from "@/lib/repos/proveedor-importaciones";

type Params = Promise<{ id: string }>;

export async function GET(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    await requireApiSession(request);
    const { id } = await params;
    const result = await getProveedorDiscounts(parseInt(id, 10));
    return NextResponse.json(result);
  } catch (error: any) {
    return jsonError(error, "Error al obtener descuentos del proveedor");
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    await requireApiWriteSession(request);
    const { id } = await params;
    const { descuentoGeneral, descuentosPorMarca, coeficientesPorMarca } = await request.json();
    
    const result = await updateProveedorDiscounts(
      parseInt(id, 10), 
      descuentoGeneral,
      descuentosPorMarca || {},
      coeficientesPorMarca || {},
    );

    return NextResponse.json(result);
  } catch (error: any) {
    return jsonError(error, "Error al actualizar descuentos del proveedor");
  }
}
