import { NextRequest, NextResponse } from "next/server";
import { createUbicacion, getUbicaciones } from "@/lib/repos/catalogos";
import { requireApiSession, requireApiWriteSession } from "@/lib/api-auth";
import { parseCatalogDescripcion } from "@/lib/validators/catalogos";
import { jsonError } from "@/lib/api-errors";

export async function GET(request: NextRequest) {
  try {
    await requireApiSession(request);
    const rows = await getUbicaciones();
    return NextResponse.json(rows);
  } catch (error: unknown) {
    return jsonError(error, "No se pudieron obtener las ubicaciones");
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireApiWriteSession(request);
    const body = await request.json();
    const payload = parseCatalogDescripcion(body);
    const result = await createUbicacion(payload.descripcion);
    return NextResponse.json(result);
  } catch (error: unknown) {
    return jsonError(error, "No se pudo crear la ubicación");
  }
}
