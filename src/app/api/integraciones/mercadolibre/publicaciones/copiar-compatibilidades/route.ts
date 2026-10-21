import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiWriteSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";
import { reintentarCompatibilidades } from "@/lib/mercadolibre";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const schema = z.object({ tipo: z.enum(["ITEM", "KIT"]), id: z.number().int().positive(), publicacion: z.number().int().positive(), destino: z.string().trim().regex(/^MLA\d+$/) });

export async function POST(request: NextRequest) {
  try {
    await requireApiWriteSession(request);
    const body = schema.parse(await request.json());
    return NextResponse.json(await reintentarCompatibilidades(body.publicacion, body.tipo, body.id, body.destino), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error, "No se pudo reintentar la copia."); }
}
