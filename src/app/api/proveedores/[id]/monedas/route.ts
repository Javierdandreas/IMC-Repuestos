import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiReadSession, requireApiWriteSession } from "@/lib/api-auth";
import { AppError, jsonError } from "@/lib/api-errors";
import { getCotizacionesProveedor, saveCotizacionesProveedor } from "@/lib/repos/proveedor-cotizaciones";

type Params = Promise<{ id: string }>;
const schema = z.array(z.object({
  codigo: z.string().min(1), activa: z.boolean(), lado: z.enum(["COMPRA", "VENTA"]),
  tipoRecargo: z.enum(["PORCENTAJE", "MONTO_FIJO"]), recargo: z.number().finite().min(0),
}));
function providerId(value: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new AppError("Proveedor invalido.", 400);
  return id;
}
export async function GET(request: NextRequest, { params }: { params: Params }) {
  try {
    await requireApiReadSession(request);
    return NextResponse.json(await getCotizacionesProveedor(providerId((await params).id)), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error, "No se pudieron obtener las monedas del proveedor."); }
}
export async function PUT(request: NextRequest, { params }: { params: Params }) {
  try {
    await requireApiWriteSession(request);
    return NextResponse.json(await saveCotizacionesProveedor(providerId((await params).id), schema.parse(await request.json())));
  } catch (error) { return jsonError(error, "No se pudieron guardar las monedas del proveedor."); }
}
