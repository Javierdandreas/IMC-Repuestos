import { NextRequest, NextResponse } from "next/server";
import { AppError, jsonError } from "@/lib/api-errors";
import { requireApiReadSession } from "@/lib/api-auth";
import { revisarPublicacionParaDuplicar } from "@/lib/mercadolibre";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireApiReadSession(request);
    const tipo = request.nextUrl.searchParams.get("tipo");
    const id = Number(request.nextUrl.searchParams.get("id"));
    const publicacion = Number(request.nextUrl.searchParams.get("publicacion"));
    if ((tipo !== "ITEM" && tipo !== "KIT") || !Number.isInteger(id) || id <= 0 || !Number.isInteger(publicacion) || publicacion <= 0) {
      throw new AppError("La publicacion solicitada no es valida.", 400);
    }
    return NextResponse.json(await revisarPublicacionParaDuplicar(publicacion, tipo, id), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error, "No se pudo revisar la publicacion.");
  }
}
