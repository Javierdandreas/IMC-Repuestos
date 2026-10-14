import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api-errors";
import { requireApiReadSession, requireApiWriteSession } from "@/lib/api-auth";
import { getPanelMultimoneda, saveConfiguracionMultimoneda } from "@/lib/multimoneda";

const schema = z.object({
  monedaDefault: z.enum(["ARS", "USD", "EUR", "BRL"]),
  referenciaDefault: z.enum(["OFICIAL", "BLUE", "MEP", "CCL"]),
  ladoDefault: z.enum(["COMPRA", "VENTA"]),
  tipoRecargoDefault: z.enum(["PORCENTAJE", "MONTO_FIJO"]),
  recargoDefault: z.coerce.number().min(0),
  umbralAprobacionPorcentaje: z.coerce.number().min(0).max(100),
});

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireApiReadSession(request);
    return NextResponse.json(await getPanelMultimoneda(), { headers: { "Cache-Control": "no-store" } });
  } catch (error: unknown) {
    return jsonError(error, "No se pudo obtener la configuracion multimoneda.");
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireApiWriteSession(request);
    return NextResponse.json(await saveConfiguracionMultimoneda(schema.parse(await request.json())));
  } catch (error: unknown) {
    return jsonError(error, "No se pudo guardar la regla global de moneda.");
  }
}
