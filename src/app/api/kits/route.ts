import { NextRequest, NextResponse } from "next/server";
import { getKitsListado, createKit } from "@/lib/repos/kits";
import { requireApiSession, requireApiWriteSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";

export async function GET(request: NextRequest) {
  await requireApiSession(request);
  try {
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page")) || 1;
    const limit = Number(searchParams.get("limit")) || 50;
    const search = searchParams.get("search") || undefined;

    const result = await getKitsListado(page, limit, search);
    return NextResponse.json(result);
  } catch (error: unknown) {
    return jsonError(error, "No se pudieron obtener los kits");
  }
}

export async function POST(request: NextRequest) {
  await requireApiWriteSession(request);
  try {
    const body = await request.json();
    
    // Validación básica (Podríamos crear un validador Zod después)
    if (!body.nombre || !body.codigo_kit || !body.componentes || body.componentes.length === 0) {
      return NextResponse.json({ error: "Nombre, código y componentes son requeridos" }, { status: 400 });
    }

    const newKit = await createKit(body);
    return NextResponse.json(newKit);
  } catch (error: unknown) {
    return jsonError(error, "No se pudo crear el kit");
  }
}
