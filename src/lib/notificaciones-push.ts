import webpush from "web-push";

import { query } from "@/lib/db-utils";

type PushSubscriptionRow = {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type NuevaPreguntaPush = {
  idCuenta: number;
  preguntaId: string;
  titulo: string | null;
  thumbnailUrl: string | null;
  texto: string;
};

type NuevoMensajePostVentaPush = {
  idCuenta: number;
  mensajeId: string;
  ventaId: string | null;
  titulo: string | null;
  thumbnailUrl: string | null;
  texto: string;
};

type PushPayload = {
  title: string;
  body: string;
  icon?: string | null;
  tag: string;
  url: string;
  data?: Record<string, unknown>;
};

function configurePush() {
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return false;

  webpush.setVapidDetails(
    process.env.WEB_PUSH_VAPID_SUBJECT?.trim() || "mailto:soporte@imc-repuestos.com",
    publicKey,
    privateKey,
  );
  return true;
}

function truncate(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length - 1).trimEnd()}...` : value;
}

async function enviarNotificacionPush(payload: PushPayload, usuarioId?: number) {
  if (!configurePush()) {
    console.warn("No se envio la notificacion push: faltan las claves VAPID.");
    return;
  }

  const { rows } = await query<PushSubscriptionRow>(
    `SELECT id, endpoint, p256dh, auth
     FROM public.notificacion_push_suscripcion
     ${usuarioId ? "WHERE usuario_id = $1" : ""}`,
    usuarioId ? [usuarioId] : [],
  );
  if (!rows.length) return;

  const serializedPayload = JSON.stringify({
    ...payload,
    icon: payload.icon || "/icon.ico",
    data: { url: payload.url, ...payload.data },
  });

  const expiredIds: number[] = [];
  await Promise.all(rows.map(async (subscription) => {
    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      }, serializedPayload, { TTL: 60 * 60 });
    } catch (error) {
      const statusCode = typeof error === "object" && error && "statusCode" in error
        ? Number((error as { statusCode?: unknown }).statusCode)
        : 0;
      if (statusCode === 404 || statusCode === 410) expiredIds.push(subscription.id);
      else console.error("No se pudo enviar una notificacion push de Mercado Libre.", error);
    }
  }));

  if (expiredIds.length) {
    await query("DELETE FROM public.notificacion_push_suscripcion WHERE id = ANY($1::bigint[])", [expiredIds]);
  }
}

export async function notificarNuevaPreguntaMercadoLibre(input: NuevaPreguntaPush) {
  const url = `/operaciones/mercadolibre?pregunta=${encodeURIComponent(input.preguntaId)}&cuenta=${input.idCuenta}`;
  await enviarNotificacionPush({
    title: truncate(input.titulo?.trim() || "Nueva pregunta de Mercado Libre", 110),
    body: truncate(input.texto, 180),
    icon: input.thumbnailUrl,
    tag: `mercadolibre-pregunta-${input.idCuenta}-${input.preguntaId}`,
    url,
    data: { preguntaId: input.preguntaId, cuentaId: input.idCuenta, titulo: input.titulo },
  });
}

export async function notificarNuevoMensajePostVentaMercadoLibre(input: NuevoMensajePostVentaPush) {
  const url = `/operaciones/mercadolibre?cuenta=${input.idCuenta}&venta=${encodeURIComponent(input.ventaId || "")}`;
  await enviarNotificacionPush({
    title: truncate(input.titulo?.trim() || "Nuevo mensaje de postventa", 110),
    body: truncate(input.texto || "El comprador envio un mensaje.", 180),
    icon: input.thumbnailUrl,
    tag: `mercadolibre-postventa-${input.idCuenta}-${input.mensajeId}`,
    url,
    data: { ventaId: input.ventaId, cuentaId: input.idCuenta },
  });
}

export async function notificarPruebaPush(usuarioId: number) {
  await enviarNotificacionPush({
    title: "Alertas de Mercado Libre activas",
    body: "Esta es una prueba de notificacion de IMC.",
    tag: `imc-prueba-${usuarioId}`,
    url: "/operaciones/mercadolibre",
  }, usuarioId);
}
