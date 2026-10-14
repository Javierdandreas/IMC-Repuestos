import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AppError, jsonError } from "@/lib/api-errors";
import { requireApiReadSession, requireApiWriteSession } from "@/lib/api-auth";
import { getConfiguracionMonedaProveedor, saveConfiguracionMonedaProveedor } from "@/lib/multimoneda";

type Params = Promise<{ id: string }>;

const schema = z.object({
  heredaGlobal: z.boolean(),
  moneda: z.enum(["ARS", "USD", "EUR", "BRL"]),
  referencia: z.enum(["OFICIAL", "BLUE", "MEP", "CCL"]),
  lado: z.enum(["COMPRA", "VENTA"]),
  tipoRecargo: z.enum(["PORCENTAJE", "MONTO_FIJO"]),
  recargo: z.coerce.number().min(0),
});

function providerId(raw: string) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new AppError("Proveedor invalido.", 400);
  return id;
}

export async function GET(request: NextRequest, { params }: { params: Params }) {
  try {
    await requireApiReadSession(request);
    const { id } = await params;
    return NextResponse.json(await getConfiguracionMonedaProveedor(providerId(id)));
  } catch (error: unknown) {
    return jsonError(error, "No se pudo obtener la moneda del proveedor.");
  }
}

export async function PUT(request: NextRequest, { params }: { params: Params }) {
  try {
    await requireApiWriteSession(request);
    const { id } = await params;
    return NextResponse.json(await saveConfiguracionMonedaProveedor(providerId(id), schema.parse(await request.json())));
  } catch (error: unknown) {
    return jsonError(error, "No se pudo guardar la moneda del proveedor.");
  }
}
