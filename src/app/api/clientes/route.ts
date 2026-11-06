import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-errors";
import { requireApiReadSession, requireApiWriteSession } from "@/lib/api-auth";
import { createCliente, getClientes } from "@/lib/repos/clientes";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireApiReadSession(request);
    const { searchParams } = new URL(request.url);
    return NextResponse.json(await getClientes({
      page: Number(searchParams.get("page") ?? 1),
      limit: Number(searchParams.get("limit") ?? 25),
      search: searchParams.get("q") ?? undefined,
      tipoPersona: searchParams.get("tipoPersona") ?? undefined,
      condicionIva: searchParams.get("condicionIva") ?? undefined,
      idTipoPrecio: searchParams.get("idTipoPrecio") ?? undefined,
      bonificacion: searchParams.get("bonificacion") ?? undefined,
      descuentoMarca: searchParams.get("descuentoMarca") ?? undefined,
      estado: searchParams.get("estado") ?? undefined,
    }), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error, "No se pudieron obtener los clientes.");
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireApiWriteSession(request);
    return NextResponse.json(await createCliente(await request.json()), { status: 201 });
  } catch (error) {
    return jsonError(error, "No se pudo crear el cliente.");
  }
}
