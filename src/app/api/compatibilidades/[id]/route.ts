import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-errors";
import { requireApiWriteSession } from "@/lib/api-auth";
import { actualizarCompatibilidadCandidata } from "@/lib/repos/compatibilidades-mercadolibre";

export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireApiWriteSession(request);
    const { id: rawId } = await context.params;
    const id = Number(rawId);
    const idCuenta = Number(request.nextUrl.searchParams.get("idCuenta"));
    if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(idCuenta) || idCuenta <= 0) throw new Error("La compatibilidad indicada no es valida.");
    return NextResponse.json(await actualizarCompatibilidadCandidata(idCuenta, id, await request.json()));
  } catch (error) {
    return jsonError(error, "No se pudo actualizar la compatibilidad.");
  }
}
