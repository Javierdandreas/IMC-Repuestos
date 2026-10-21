import { NextRequest, NextResponse } from "next/server";
import { AppError, jsonError } from "@/lib/api-errors";
import { requireApiWriteSession } from "@/lib/api-auth";
import { probarCreacionPublicacion } from "@/lib/mercadolibre";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    await requireApiWriteSession(request);
    const body = await request.json();
    const { tipo, id, publicacion } = body;
    const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
    const descripcion = typeof body.descripcion === "string" ? body.descripcion : "";
    if ((tipo !== "ITEM" && tipo !== "KIT") || !Number.isInteger(id) || id <= 0 || !Number.isInteger(publicacion) || publicacion <= 0 || !nombre || nombre.length > 60 || descripcion.length > 50000 || body.confirmar !== true) {
      throw new AppError("Los datos o la confirmacion de la prueba no son validos.", 400);
    }
    return NextResponse.json(await probarCreacionPublicacion(publicacion, tipo, id, nombre, descripcion), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error, "No se pudo iniciar la prueba. Revisa la cuenta antes de volver a intentar.");
  }
}
