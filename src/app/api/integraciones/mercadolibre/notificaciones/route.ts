import { createHash, createHmac, timingSafeEqual } from "crypto";

import { after, NextRequest, NextResponse } from "next/server";

import { query } from "@/lib/db-utils";
import { procesarEventoMercadoLibre } from "@/lib/mercadolibre";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TOPICS = new Set(["orders_v2", "questions", "items"]);

type MeliNotification = {
  topic?: unknown;
  resource?: unknown;
  user_id?: unknown;
  sent?: unknown;
  id?: unknown;
  data?: { id?: unknown };
};

function signatureParts(value: string | null) {
  if (!value) return null;
  const parts = new Map(value.split(",").map((part) => {
    const [key, ...rest] = part.trim().split("=");
    return [key, rest.join("=")];
  }));
  const timestamp = parts.get("ts");
  const signature = parts.get("v1");
  return timestamp && signature ? { timestamp, signature } : null;
}

function validSignature(notification: MeliNotification, request: NextRequest) {
  const secret = process.env.MELI_WEBHOOK_SECRET?.trim() || process.env.MELI_CLIENT_SECRET?.trim();
  const parsed = signatureParts(request.headers.get("x-signature"));
  const requestId = request.headers.get("x-request-id");
  const resourceId = String(notification.data?.id ?? notification.id ?? notification.resource ?? "").split("/").filter(Boolean).pop();
  if (!secret || !parsed || !requestId || !resourceId) return false;
  const timestamp = Number(parsed.timestamp);
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp * 1000) > 5 * 60 * 1000) return false;
  const manifest = `id:${resourceId};request-id:${requestId};ts:${parsed.timestamp};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  const actual = parsed.signature.toLowerCase();
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(actual, "hex") as never, Buffer.from(expected, "hex") as never);
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  let notification: MeliNotification;
  try {
    notification = JSON.parse(rawBody) as MeliNotification;
  } catch {
    return NextResponse.json({ message: "Payload invalido." }, { status: 400 });
  }

  if (!validSignature(notification, request)) {
    return NextResponse.json({ message: "Firma invalida." }, { status: 401 });
  }

  const topic = typeof notification.topic === "string" ? notification.topic : "";
  const resource = typeof notification.resource === "string" ? notification.resource : "";
  const sellerId = Number(notification.user_id);
  if (!TOPICS.has(topic) || !resource.startsWith("/") || !Number.isSafeInteger(sellerId)) {
    return NextResponse.json({ ok: true, ignored: true }, { headers: { "Cache-Control": "no-store" } });
  }

  const account = await query<{ id: number }>(
    "SELECT id FROM public.mercadolibre_cuenta WHERE seller_id = $1 AND conectada = TRUE LIMIT 1",
    [sellerId],
  );
  const idCuenta = account.rows[0]?.id;
  if (!idCuenta) {
    return NextResponse.json({ ok: true, ignored: true }, { headers: { "Cache-Control": "no-store" } });
  }

  const requestId = request.headers.get("x-request-id");
  const fingerprint = `${topic}|${resource}|${String(notification.sent || "")}|${requestId || rawBody}`;
  const eventKey = createHash("sha256").update(fingerprint).digest("hex");
  const inserted = await query<{ id: number }>(
    `INSERT INTO public.mercadolibre_webhook_evento (
      id_cuenta, evento_key, topic, recurso, seller_id, request_id, payload
    ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
    ON CONFLICT (evento_key) DO NOTHING
    RETURNING id`,
    [idCuenta, eventKey, topic, resource, sellerId, requestId, rawBody],
  );
  const idEvento = inserted.rows[0]?.id;
  if (idEvento) {
    after(async () => {
      try {
        await procesarEventoMercadoLibre(idEvento);
      } catch (error) {
        console.error("[MERCADO LIBRE WEBHOOK] Error al procesar evento:", error);
      }
    });
  }

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
