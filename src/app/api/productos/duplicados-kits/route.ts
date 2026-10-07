import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiReadSession, requireApiWriteSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";
import { limpiarItemsDuplicadosConKits, listarItemsDuplicadosConKits } from "@/lib/repos/conversion-kits";

export async function GET(request: NextRequest) {
  try {
    await requireApiReadSession(request);
    return NextResponse.json(await listarItemsDuplicadosConKits());
  } catch (error) {
    return jsonError(error, "No se pudieron revisar los items duplicados con kits.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiWriteSession(request);
    const { ids } = z.object({ ids: z.array(z.number().int().positive()).min(1).max(500) }).parse(await request.json());
    return NextResponse.json({ deletedCodes: await limpiarItemsDuplicadosConKits(ids, user.usuarioId) });
  } catch (error) {
    return jsonError(error, "No se pudieron eliminar los items duplicados con kits.");
  }
}
