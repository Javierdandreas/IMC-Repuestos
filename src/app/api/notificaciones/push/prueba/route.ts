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
    await notificarPruebaPush(session.usuarioId);
    return NextResponse.json({ sent: true });
  } catch (error) {
    return jsonError(error, "No se pudo enviar la alerta de prueba.");
  }
}
