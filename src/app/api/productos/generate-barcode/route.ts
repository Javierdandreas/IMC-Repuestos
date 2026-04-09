import { NextRequest, NextResponse } from "next/server";
import { generateUniqueBarcode } from "@/lib/repos/productos";
import { requireApiSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";

export async function GET(request: NextRequest) {
  try {
    await requireApiSession(request);
    
    const barcode = await generateUniqueBarcode();
    
    return NextResponse.json({ barcode });
  } catch (error: unknown) {
    return jsonError(error, "No se pudo generar el código de barra");
  }
}
