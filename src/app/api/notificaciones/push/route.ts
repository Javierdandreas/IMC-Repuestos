import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { jsonError } from "@/lib/api-errors";
import { requireApiReadSession } from "@/lib/api-auth";
import { query } from "@/lib/db-utils";

export const dynamic = "force-dynamic";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2_000),
  keys: z.object({
    p256dh: z.string().min(1).max(1_000),
    auth: z.string().min(1).max(1_000),
  }),
});

export async function GET(request: NextRequest) {
  try {
    await requireApiReadSession(request);
    const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim() || null;
    const configured = Boolean(publicKey && process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim());
    return NextResponse.json({ configured, publicKey: configured ? publicKey : null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error, "No se pudo consultar la configuracion de notificaciones.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiReadSession(request);
    const subscription = subscriptionSchema.parse(await request.json());
    await query(
      `INSERT INTO public.notificacion_push_suscripcion (usuario_id, endpoint, p256dh, auth, user_agent)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (endpoint) DO UPDATE SET
         usuario_id = EXCLUDED.usuario_id,
         p256dh = EXCLUDED.p256dh,
         auth = EXCLUDED.auth,
         user_agent = EXCLUDED.user_agent,
         updated_at = NOW()`,
      [session.usuarioId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth, request.headers.get("user-agent")?.slice(0, 1_000) || null],
    );
    return NextResponse.json({ subscribed: true });
  } catch (error) {
    return jsonError(error, "No se pudo activar las notificaciones.");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireApiReadSession(request);
    const { endpoint } = z.object({ endpoint: z.string().url().max(2_000) }).parse(await request.json());
    await query(
      "DELETE FROM public.notificacion_push_suscripcion WHERE usuario_id = $1 AND endpoint = $2",
      [session.usuarioId, endpoint],
    );
    return NextResponse.json({ subscribed: false });
  } catch (error) {
    return jsonError(error, "No se pudo desactivar las notificaciones.");
  }
}
