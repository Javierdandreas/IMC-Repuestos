import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiWriteSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";
import { aplicarCambioMasivoItems } from "@/lib/repos/cambio-masivo-items";

const schema = z.object({
  items: z.array(z.object({
    id: z.number().int().positive(),
    tipo: z.enum(["ITEM", "KIT"]),
  })).min(1).max(500),
  campo: z.enum(["CLASIFICACION", "MARCA", "PROVEEDOR", "UBICACION", "OBSERVACION", "PALABRAS_CLAVE"]),
  idCategoria: z.number().int().positive().optional(),
  idSubcategoria: z.number().int().positive().optional(),
  idMarca: z.number().int().positive().optional(),
  idProveedor: z.number().int().positive().optional(),
  idUbicacion: z.number().int().positive().optional(),
  texto: z.string().max(5000).optional(),
});

export async function POST(request: NextRequest) {
  const session = await requireApiWriteSession(request);
  try {
    const payload = schema.parse(await request.json());
    const result = await aplicarCambioMasivoItems({ ...payload, usuarioId: session.usuarioId });
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error, "No se pudo aplicar el cambio masivo");
  }
}
