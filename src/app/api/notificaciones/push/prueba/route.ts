import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/api-errors";
import { requireApiReadSession } from "@/lib/api-auth";
import { notificarPruebaPush } from "@/lib/notificaciones-push";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiReadSession(request);
    if (!process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim() || !process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim()) {
      return NextResponse.json({ message: "Faltan las claves VAPID de notificaciones en el servidor." }, { status: 503 });
    }
    const result = await notificarPruebaPush(session.usuarioId);
    if (!result.suscripciones) {
      return NextResponse.json({ message: "No hay dispositivos suscriptos para este usuario." }, { status: 422 });
    }
    if (!result.enviados) {
      return NextResponse.json({ message: "El servicio push rechazo todas las suscripciones. Reactiva las alertas en este dispositivo." }, { status: 502 });
    }
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error, "No se pudo enviar la alerta de prueba.");
  }
}
