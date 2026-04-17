import { NextRequest, NextResponse } from "next/server";
import { getPiezasBusquedaLive } from "@/lib/repos/piezas";
import { requireApiSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";

export async function GET(request: NextRequest) {
  await requireApiSession(request);
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";

    if (!query.trim()) {
      return NextResponse.json([]);
    }

    const result = await getPiezasBusquedaLive(query);
    return NextResponse.json(result);
  } catch (error: unknown) {
    return jsonError(error, "No se pudo realizar la búsqueda de piezas");
  }
}
