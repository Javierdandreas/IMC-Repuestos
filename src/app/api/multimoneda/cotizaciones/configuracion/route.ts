import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api-errors";
import { requireApiWriteSession } from "@/lib/api-auth";
import { saveCotizacionesConfiguradas } from "@/lib/multimoneda";

const schema = z.object({
  cotizaciones: z.array(z.object({
    codigo: z.string().trim().min(1).max(50),
    modo: z.enum(["MANUAL", "AUTOMATICA"]),
    tipoRecargo: z.enum(["PORCENTAJE", "MONTO_FIJO"]),
    recargo: z.coerce.number().min(0),
    valorManual: z.coerce.number().positive().nullable(),
  })).min(1).max(20),
});

export async function PUT(request: NextRequest) {
  try {
    await requireApiWriteSession(request);
    const { cotizaciones } = schema.parse(await request.json());
    return NextResponse.json(await saveCotizacionesConfiguradas(cotizaciones));
  } catch (error: unknown) {
    return jsonError(error, "No se pudo guardar la configuracion de cotizaciones.");
  }
}
