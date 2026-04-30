import { NextRequest, NextResponse } from "next/server";
import { searchComponentesForKit } from "@/modules/kits/repos/kits";
import { requireApiSession } from "@/modules/auth/repos/api-auth";
import { jsonError } from "@/lib/api-errors";

export async function GET(request: NextRequest) {
  await requireApiSession(request);
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";

    if (query.length < 3) {
      return NextResponse.json([]);
    }

    const result = await searchComponentesForKit(query);
    return NextResponse.json(result);
  } catch (error: unknown) {
    return jsonError(error, "Error en la búsqueda de componentes");
  }
}
