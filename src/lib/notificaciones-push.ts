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
  texto: string;
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

export async function notificarNuevaPreguntaMercadoLibre(input: NuevaPreguntaPush) {
  if (!configurePush()) {
    console.warn("No se envio la notificacion push: faltan las claves VAPID.");
    return;
  }

  const { rows } = await query<PushSubscriptionRow>(
    "SELECT id, endpoint, p256dh, auth FROM public.notificacion_push_suscripcion",
  );
  if (!rows.length) return;

  const url = `/operaciones/mercadolibre?pregunta=${encodeURIComponent(input.preguntaId)}&cuenta=${input.idCuenta}`;
  const payload = JSON.stringify({
    title: "Nueva pregunta de Mercado Libre",
    body: truncate(input.texto, 180),
    tag: `mercadolibre-pregunta-${input.idCuenta}-${input.preguntaId}`,
    url,
    data: { url, preguntaId: input.preguntaId, cuentaId: input.idCuenta, titulo: input.titulo },
  });

  const expiredIds: number[] = [];
  await Promise.all(rows.map(async (subscription) => {
    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      }, payload, { TTL: 60 * 60 });
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
