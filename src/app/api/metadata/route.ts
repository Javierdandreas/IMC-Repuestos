import { NextRequest, NextResponse } from "next/server";
import { getProductMeta } from "@/lib/productos-meta";
import { requireApiReadSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";

export async function GET(request: NextRequest) {
  try {
    await requireApiReadSession(request);
    const meta = await getProductMeta();
    return NextResponse.json(meta);
  } catch (error: any) {
    return jsonError(error, "Error al obtener metadatos");
  }
}
