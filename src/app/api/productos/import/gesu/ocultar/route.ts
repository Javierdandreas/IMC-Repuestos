import { NextRequest, NextResponse } from "next/server";
import { requireApiWriteSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";

export async function POST(request: NextRequest) {
  try {
    await requireApiWriteSession(request);
    return NextResponse.json({ message: "Este flujo fue reemplazado. Actualiza la pagina para usar la importacion atomica." }, { status: 410 });
  } catch (error: unknown) {
    return jsonError(error, "No se pudieron ocultar los productos convertidos en kits");
  }
}
