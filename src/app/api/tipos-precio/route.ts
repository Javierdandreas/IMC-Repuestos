import { NextRequest, NextResponse } from "next/server";
import { requireApiReadSession, requireApiWriteSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";
import { createTipoPrecioConfig, getTiposPrecio, updateTiposPrecioConfig } from "@/lib/repos/catalogos";

export async function GET(request: NextRequest) {
  try {
    await requireApiReadSession(request);
    const data = await getTiposPrecio();
    return NextResponse.json(data);
  } catch (error) {
    return jsonError(error, "No se pudieron obtener las listas de precio");
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireApiWriteSession(request);
    const body = await request.json();
    const data = await updateTiposPrecioConfig(body.items);
    return NextResponse.json(data);
  } catch (error) {
    return jsonError(error, "No se pudieron guardar las listas de precio");
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireApiWriteSession(request);
    const body = await request.json();
    const data = await createTipoPrecioConfig(body);
    return NextResponse.json(data);
  } catch (error) {
    return jsonError(error, "No se pudo crear la lista de precio");
  }
}
