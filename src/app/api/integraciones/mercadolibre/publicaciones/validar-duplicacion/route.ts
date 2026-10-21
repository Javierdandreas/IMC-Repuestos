import { NextRequest, NextResponse } from "next/server";
import { AppError, jsonError } from "@/lib/api-errors";
import { requireApiWriteSession } from "@/lib/api-auth";
import { validarPublicacionParaDuplicar } from "@/lib/mercadolibre";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    await requireApiWriteSession(request);
    const body = await request.json();
    const { tipo, id, publicacion } = body;
    const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
    if ((tipo !== "ITEM" && tipo !== "KIT") || !Number.isInteger(id) || id <= 0 || !Number.isInteger(publicacion) || publicacion <= 0 || !nombre || nombre.length > 200) {
      throw new AppError("Los datos de la validacion no son validos.", 400);
    }
    return NextResponse.json(await validarPublicacionParaDuplicar(publicacion, tipo, id, nombre), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error, "No se pudo validar la publicacion.");
  }
}
