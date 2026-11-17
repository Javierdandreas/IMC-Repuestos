import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AppError } from "@/lib/api-errors";
import { query } from "@/lib/db-utils";
import { cotizacionClienteSchema, cotizarCliente } from "@/lib/repos/cotizaciones-cliente";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorize(request: NextRequest) {
  const expected = process.env.PARTNER_CATALOG_API_KEY?.trim();
  if (!expected) throw new AppError("API de cotizaciones no configurada.", 503);
  const received = request.headers.get("x-api-key")?.trim();
  if (!received) throw new AppError("No autorizado.", 401);
  const encoder = new TextEncoder();
  const a = encoder.encode(expected), b = encoder.encode(received);
  if (a.length !== b.length || !timingSafeEqual(a,b)) throw new AppError("No autorizado.", 401);
}

function failure(error: unknown) {
  if (error instanceof AppError) return NextResponse.json({message:error.message}, {status:error.status});
  if (error instanceof z.ZodError) return NextResponse.json({message:"Parametros invalidos.", errores: error.issues.map((i) => ({campo:i.path.join("."), mensaje:i.message}))}, {status:400});
  if (error instanceof SyntaxError) return NextResponse.json({message:"El cuerpo debe ser JSON valido."}, {status:400});
  console.error("[PARTNER COTIZAR] Error al cotizar:", error);
  return NextResponse.json({message:"No se pudo calcular la cotizacion."}, {status:500});
}

export async function POST(request: NextRequest) {
  try {
    authorize(request);
    const input = cotizacionClienteSchema.parse(await request.json());
    return NextResponse.json(await cotizarCliente(input), {headers:{"Cache-Control":"private, no-store"}});
  } catch (error) { return failure(error); }
}

export async function GET(request: NextRequest) {
  try {
    authorize(request);
    const id = z.uuid().parse(request.nextUrl.searchParams.get("id"));
    const saved = await query<{respuesta: unknown}>("SELECT respuesta FROM public.partner_cotizacion WHERE id=$1", [id]);
    if (!saved.rowCount) throw new AppError("Cotizacion no encontrada.",404);
    return NextResponse.json(saved.rows[0].respuesta, {headers:{"Cache-Control":"private, no-store"}});
  } catch (error) { return failure(error); }
}
