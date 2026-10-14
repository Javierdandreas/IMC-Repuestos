import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api-errors";
import { requireApiWriteSession } from "@/lib/api-auth";
import { registerManualCurrencyQuote } from "@/lib/multimoneda";

const numeric = z.union([z.coerce.number().positive(), z.null()]).optional().transform((value) => value ?? null);
const schema = z.object({
  moneda: z.enum(["ARS", "USD", "EUR", "BRL"]),
  referencia: z.enum(["OFICIAL", "BLUE", "MEP", "CCL"]),
  valorCompra: numeric,
  valorVenta: numeric,
  observacion: z.string().trim().max(300).nullable().optional(),
});

export async function POST(request: NextRequest) {
  try {
    await requireApiWriteSession(request);
    return NextResponse.json(await registerManualCurrencyQuote(schema.parse(await request.json())));
  } catch (error: unknown) {
    return jsonError(error, "No se pudo registrar la cotizacion.");
  }
}
