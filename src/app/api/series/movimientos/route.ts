import { NextRequest, NextResponse } from "next/server";
import { requireApiWriteSession } from "@/modules/auth/repos/api-auth";
import { updateSeriesState } from "@/modules/series/repos/series";
import { validateUpdateSeriesStatePayload } from "@/modules/series/validators/series";
import { jsonError } from "@/lib/api-errors";

export async function POST(request: NextRequest) {
  const session = await requireApiWriteSession(request);
  try {
    const body = await request.json();
    const payload = validateUpdateSeriesStatePayload(body);

    await updateSeriesState(
      payload.ids_series,
      payload.estado,
      payload.tipo_movimiento,
      session.usuarioId,
      payload.id_ubicacion_destino,
      payload.referencia,
      payload.observacion
    );

    return NextResponse.json({ message: "Movimiento registrado exitosamente y estado actualizado" }, { status: 200 });
  } catch (error: unknown) {
    return jsonError(error, "No se pudo registrar el movimiento de las series");
  }
}
