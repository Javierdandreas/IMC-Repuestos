import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiWriteSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";
import { gesuRequestSchema } from "@/lib/gesu-importacion";
import { iniciarImportacionGesu, guardarLoteGesu, aplicarImportacionGesu, estadoImportacionGesu } from "@/lib/repos/importacion-gesu";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiWriteSession(request);
    const body = gesuRequestSchema.parse(await request.json());
    if (body.action === "iniciar") return NextResponse.json(await iniciarImportacionGesu(body.id, user.usuarioId, body.fileName, body.totalBatches));
    if (body.action === "lote") return NextResponse.json(await guardarLoteGesu(body.id, user.usuarioId, body.batch, body.type, body.rows));
    return NextResponse.json({ result: await aplicarImportacionGesu(body.id, user.usuarioId, user.nombreUsuario || user.email || "Usuario") });
  } catch (error) { return jsonError(error, "No se pudo completar la importacion GESU. Consulta su estado antes de reintentar."); }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireApiWriteSession(request);
    const id = z.uuid().parse(request.nextUrl.searchParams.get("id"));
    return NextResponse.json(await estadoImportacionGesu(id, user.usuarioId));
  } catch (error) { return jsonError(error, "No se pudo consultar la importacion."); }
}
