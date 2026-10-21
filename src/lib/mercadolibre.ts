import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

import { AppError } from "@/lib/api-errors";
import { query, withTransaction } from "@/lib/db-utils";
import { notificarNuevaPreguntaMercadoLibre } from "@/lib/notificaciones-push";
import { interpretarValidacionPublicacion, prepararValidacionPublicacion, protegerDiagnostico } from "@/lib/mercadolibre-validacion-publicacion";
import type {
  MercadoLibreCuentaEstado,
  MercadoLibreCostoEstimado,
  MercadoLibreCostoSincronizacion,
  MercadoLibrePublicacion,
  MercadoLibrePublicacionesResult,
  MercadoLibrePreguntaListado,
  MercadoLibrePreguntasResult,
  MercadoLibreSyncResult,
  MercadoLibreVentaListado,
  MercadoLibreVentasResult,
} from "@/interfaces/mercadolibre";

const API_BASE_URL = "https://api.mercadolibre.com";
const AUTH_BASE_URL = "https://auth.mercadolibre.com.ar/authorization";
const REFRESH_MARGIN_MS = 60_000;
const ITEM_BATCH_SIZE = 20;
const MAX_SYNC_ITEMS = 25_000;

type MercadoLibreConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  encryptionSecret: string;
};

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope?: string;
  user_id: number;
};

type CuentaTokenRow = {
  id: number;
  seller_id: number;
  access_token_cifrado: string;
  refresh_token_cifrado: string;
  access_token_expira_at: string;
};

type MeliItem = {
  id: string;
  title?: string;
  status?: string;
  category_id?: string;
  listing_type_id?: string;
  price?: number;
  original_price?: number | null;
  currency_id?: string;
  available_quantity?: number;
  sold_quantity?: number;
  thumbnail?: string;
  permalink?: string;
  date_created?: string;
  last_updated?: string;
  seller_custom_field?: string | null;
  attributes?: Array<{ id?: string; value_name?: string | null }>;
  variations?: Array<Record<string, unknown>>;
  condition?: string;
  shipping?: {
    mode?: string;
    logistic_type?: string;
    free_shipping?: boolean;
    dimensions?: string | null;
  };
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new AppError(`Falta configurar ${name} en Vercel.`, 503);
  return value;
}

function getConfig(): MercadoLibreConfig {
  const redirectUri = requiredEnv("MELI_REDIRECT_URI");
  try {
    const url = new URL(redirectUri);
    if (url.protocol !== "https:") throw new Error();
  } catch {
    throw new AppError("MELI_REDIRECT_URI debe ser una URL HTTPS valida.", 503);
  }
  return {
    clientId: requiredEnv("MELI_CLIENT_ID"),
    clientSecret: requiredEnv("MELI_CLIENT_SECRET"),
    redirectUri,
    encryptionSecret: requiredEnv("MELI_TOKEN_ENCRYPTION_KEY"),
  };
}

function tokenKey(secret: string) {
  return createHash("sha256").update(secret).digest();
}

function encrypt(value: string, secret: string) {
  const iv = randomBytes(12);
  // @types/node bundled with this project models Buffer more narrowly than Node itself.
  const cipher = createCipheriv("aes-256-gcm", tokenKey(secret) as never, iv as never);
  const encrypted = cipher.update(value, "utf8", "base64url") + cipher.final("base64url");
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted].join(".");
}

function decrypt(value: string, secret: string) {
  const [iv, tag, encrypted] = value.split(".");
  if (!iv || !tag || !encrypted) throw new AppError("No se pudo leer la credencial cifrada de Mercado Libre.", 500);
  try {
    const decipher = createDecipheriv("aes-256-gcm", tokenKey(secret) as never, Buffer.from(iv, "base64url") as never);
    decipher.setAuthTag(Buffer.from(tag, "base64url") as never);
    return decipher.update(encrypted, "base64url", "utf8") + decipher.final("utf8");
  } catch {
    throw new AppError("No se pudo descifrar la credencial de Mercado Libre. Verifica MELI_TOKEN_ENCRYPTION_KEY.", 500);
  }
}

function normalizeCode(value: string | null | undefined) {
  return (value || "").trim().toUpperCase();
}

function normalizeMatchingCode(value: string | null | undefined) {
  return normalizeCode(value).replace(/[^A-Z0-9]+/g, "");
}

function mapCuenta(row: Record<string, unknown>): MercadoLibreCuentaEstado {
  return {
    id: Number(row.id),
    sellerId: Number(row.seller_id),
    nickname: row.nickname ? String(row.nickname) : null,
    siteId: String(row.site_id || "MLA"),
    conectadaAt: new Date(String(row.conectada_at)).toISOString(),
    ultimaSincronizacionAt: row.ultima_sincronizacion_at ? new Date(String(row.ultima_sincronizacion_at)).toISOString() : null,
    ultimoEstadoSincronizacion: row.ultimo_estado_sincronizacion as MercadoLibreCuentaEstado["ultimoEstadoSincronizacion"],
    ultimoErrorSincronizacion: row.ultimo_error_sincronizacion ? String(row.ultimo_error_sincronizacion) : null,
  };
}

export function getMercadoLibreAuthorizationUrl(state: string, codeChallenge: string) {
  const config = getConfig();
  const url = new URL(AUTH_BASE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

async function getTokenFromCode(code: string, codeVerifier: string): Promise<TokenResponse> {
  const config = getConfig();
  const form = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: config.redirectUri,
    code_verifier: codeVerifier,
  });
  const response = await fetch(`${API_BASE_URL}/oauth/token`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
    cache: "no-store",
  });
  if (!response.ok) throw new AppError("Mercado Libre rechazo la autorizacion. Revisa el Redirect URI y volve a conectar la cuenta.", 502);
  return response.json() as Promise<TokenResponse>;
}

async function refreshToken(refreshToken: string): Promise<TokenResponse> {
  const config = getConfig();
  const form = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
  });
  const response = await fetch(`${API_BASE_URL}/oauth/token`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
    cache: "no-store",
  });
  if (!response.ok) throw new AppError("La conexion con Mercado Libre vencio o fue revocada. Volve a conectar la cuenta.", 401);
  return response.json() as Promise<TokenResponse>;
}

async function getMeliUser(accessToken: string, sellerId: number) {
  const response = await fetch(`${API_BASE_URL}/users/${sellerId}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new AppError("No se pudo verificar la cuenta de Mercado Libre.", 502);
  const user = await response.json() as { nickname?: string; site_id?: string };
  return { nickname: user.nickname?.trim() || null, siteId: user.site_id?.trim() || "MLA" };
}

export async function conectarMercadoLibre(code: string, codeVerifier: string) {
  const token = await getTokenFromCode(code, codeVerifier);
  const [config, user] = await Promise.all([Promise.resolve(getConfig()), getMeliUser(token.access_token, token.user_id)]);
  const expiresAt = new Date(Date.now() + Math.max(1, Number(token.expires_in)) * 1000);
  await query(
    `INSERT INTO public.mercadolibre_cuenta (
      seller_id, nickname, site_id, scope, access_token_cifrado, refresh_token_cifrado, access_token_expira_at,
      conectada, conectada_at, updated_at, ultimo_estado_sincronizacion, ultimo_error_sincronizacion
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, NOW(), NOW(), NULL, NULL)
    ON CONFLICT (seller_id) DO UPDATE SET
      nickname = EXCLUDED.nickname, site_id = EXCLUDED.site_id, scope = EXCLUDED.scope,
      access_token_cifrado = EXCLUDED.access_token_cifrado, refresh_token_cifrado = EXCLUDED.refresh_token_cifrado,
      access_token_expira_at = EXCLUDED.access_token_expira_at, conectada = TRUE, updated_at = NOW(),
      ultimo_estado_sincronizacion = NULL, ultimo_error_sincronizacion = NULL`,
    [token.user_id, user.nickname, user.siteId, token.scope || null, encrypt(token.access_token, config.encryptionSecret), encrypt(token.refresh_token, config.encryptionSecret), expiresAt]
  );
}

export async function getMercadoLibreCuentas(): Promise<MercadoLibreCuentaEstado[]> {
  const { rows } = await query(
    `SELECT id, seller_id, nickname, site_id, conectada_at, ultima_sincronizacion_at,
      ultimo_estado_sincronizacion, ultimo_error_sincronizacion
     FROM public.mercadolibre_cuenta
     WHERE conectada = TRUE
     ORDER BY conectada_at DESC`
  );
  return rows.map(mapCuenta);
}

export async function getMercadoLibrePublicaciones(
  idCuenta: number,
  page = 1,
  limit = 50,
  search = "",
  tipoVinculo?: "SIN_VINCULO" | "EXCLUIDO_MANUAL",
  fechaDesde?: string,
  fechaHasta?: string,
): Promise<MercadoLibrePublicacionesResult> {
  const term = search.trim();
  const filters = ["publication.id_cuenta = $1"];
  const params: Array<string | number> = [idCuenta];
  if (tipoVinculo) {
    params.push(tipoVinculo);
    filters.push(`publication.tipo_vinculo = $${params.length}`);
  }
  if (fechaDesde) {
    params.push(fechaDesde);
    filters.push(`NULLIF(publication.datos->>'fechaCreacionMl', '')::timestamptz >= $${params.length}::date`);
  }
  if (fechaHasta) {
    params.push(fechaHasta);
    filters.push(`NULLIF(publication.datos->>'fechaCreacionMl', '')::timestamptz < ($${params.length}::date + INTERVAL '1 day')`);
  }
  if (term) {
    params.push(`%${term}%`);
    const parameter = `$${params.length}`;
    filters.push(`(
      publication.item_id ILIKE ${parameter}
      OR COALESCE(publication.seller_sku, '') ILIKE ${parameter}
      OR publication.titulo ILIKE ${parameter}
      OR COALESCE(product.cod_unico, '') ILIKE ${parameter}
      OR COALESCE(product.descripcion, '') ILIKE ${parameter}
      OR COALESCE(kit.codigo_kit, '') ILIKE ${parameter}
      OR COALESCE(kit.nombre, '') ILIKE ${parameter}
    )`);
  }
  const where = filters.join(" AND ");
  const totalResult = await query<{ total_count: number }>(
    `SELECT COUNT(*)::int AS total_count
     FROM public.mercadolibre_publicacion publication
     LEFT JOIN public.productos product ON product.id = publication.id_producto
     LEFT JOIN public.kits kit ON kit.id = publication.id_kit
     WHERE ${where}`,
    params,
  );
  const totalCount = Number(totalResult.rows[0]?.total_count || 0);
  if (!totalCount) return { data: [], totalCount: 0, totalPages: 0 };
  const safePage = Math.max(1, page);
  const { rows } = await query(
    `SELECT publication.id, publication.item_id, publication.id_producto, publication.id_kit, publication.tipo_vinculo, publication.seller_sku,
      publication.titulo, publication.estado, publication.categoria_id, publication.tipo_publicacion, publication.precio,
      publication.precio_original, publication.moneda, publication.cantidad_disponible, publication.cantidad_vendida,
      publication.thumbnail_url, publication.permalink, publication.variaciones, publication.sincronizada_at,
      publication.costo_estimado, publication.costo_estimado_at,
      NULLIF(publication.datos->>'fechaCreacionMl', '') AS fecha_creacion_ml,
      NULLIF(publication.datos->>'fechaActualizacionMl', '') AS fecha_actualizacion_ml,
      product.cod_unico AS codigo_producto, product.descripcion AS producto,
      kit.codigo_kit AS codigo_kit, kit.nombre AS kit
     FROM public.mercadolibre_publicacion publication
     LEFT JOIN public.productos product ON product.id = publication.id_producto
     LEFT JOIN public.kits kit ON kit.id = publication.id_kit
     WHERE ${where}
     ORDER BY publication.sincronizada_at DESC, publication.item_id ASC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, (safePage - 1) * limit]
  );
  return {
    data: rows.map((row) => ({
      id: Number(row.id), itemId: String(row.item_id), idProducto: row.id_producto === null ? null : Number(row.id_producto),
      idKit: row.id_kit === null ? null : Number(row.id_kit),
      codigoProducto: row.codigo_producto ? String(row.codigo_producto) : null, producto: row.producto ? String(row.producto) : null,
      codigoKit: row.codigo_kit ? String(row.codigo_kit) : null, kit: row.kit ? String(row.kit) : null,
      tipoVinculo: row.tipo_vinculo, sellerSku: row.seller_sku ? String(row.seller_sku) : null, titulo: String(row.titulo),
      estado: String(row.estado), categoriaId: row.categoria_id ? String(row.categoria_id) : null,
      tipoPublicacion: row.tipo_publicacion ? String(row.tipo_publicacion) : null,
      precio: row.precio === null ? null : Number(row.precio), precioOriginal: row.precio_original === null ? null : Number(row.precio_original),
      moneda: row.moneda ? String(row.moneda) : null, cantidadDisponible: row.cantidad_disponible === null ? null : Number(row.cantidad_disponible),
      cantidadVendida: row.cantidad_vendida === null ? null : Number(row.cantidad_vendida), thumbnailUrl: secureThumbnailUrl(row.thumbnail_url ? String(row.thumbnail_url) : null),
      permalink: row.permalink ? String(row.permalink) : null, variaciones: Array.isArray(row.variaciones) ? row.variaciones : [],
      fechaCreacionMl: row.fecha_creacion_ml ? new Date(String(row.fecha_creacion_ml)).toISOString() : null,
      fechaActualizacionMl: row.fecha_actualizacion_ml ? new Date(String(row.fecha_actualizacion_ml)).toISOString() : null,
      sincronizadaAt: new Date(String(row.sincronizada_at)).toISOString(),
      costoEstimado: row.costo_estimado && typeof row.costo_estimado === "object" ? {
        ...(row.costo_estimado as MercadoLibreCostoEstimado),
        consultadoAt: row.costo_estimado_at ? new Date(String(row.costo_estimado_at)).toISOString() : String((row.costo_estimado as MercadoLibreCostoEstimado).consultadoAt || ""),
      } : null,
    })),
    totalCount,
    totalPages: Math.ceil(totalCount / limit),
  };
}

export async function getMercadoLibreVentas(idCuenta: number, page = 1, limit = 50): Promise<MercadoLibreVentasResult> {
  const totalResult = await query<{ total_count: number }>("SELECT COUNT(*)::int AS total_count FROM public.mercadolibre_venta WHERE id_cuenta = $1", [idCuenta]);
  const totalCount = Number(totalResult.rows[0]?.total_count || 0);
  if (!totalCount) return { data: [], totalCount: 0, totalPages: 0 };
  const safePage = Math.max(1, page);
  const { rows } = await query(
    `SELECT id, venta_id, fecha, estado, comprador, total, moneda, envio, retiro_en_persona,
            NULLIF(datos #>> '{shipping,id}', '') AS numero_envio, items, sincronizada_at
     FROM public.mercadolibre_venta WHERE id_cuenta = $1
     ORDER BY fecha DESC NULLS LAST, id DESC LIMIT $2 OFFSET $3`,
    [idCuenta, limit, (safePage - 1) * limit],
  );
  return {
    data: rows.map((row): MercadoLibreVentaListado => ({
      id: Number(row.id), ventaId: String(row.venta_id), fecha: row.fecha ? new Date(String(row.fecha)).toISOString() : null,
      estado: String(row.estado), comprador: row.comprador ? String(row.comprador) : null,
      total: row.total === null ? null : Number(row.total), moneda: row.moneda ? String(row.moneda) : null,
      envio: row.envio ? String(row.envio) : null, retiroEnPersona: Boolean(row.retiro_en_persona),
      numeroEnvio: row.numero_envio ? String(row.numero_envio) : null,
      items: Array.isArray(row.items) ? row.items.map((item: Record<string, unknown>) => ({ itemId: item.itemId ? String(item.itemId) : null, titulo: String(item.titulo || "Sin titulo"), cantidad: Number(item.cantidad || 0), sku: item.sku ? String(item.sku) : null })) : [],
      sincronizadaAt: new Date(String(row.sincronizada_at)).toISOString(),
    })),
    totalCount,
    totalPages: Math.ceil(totalCount / limit),
  };
}

export type MercadoLibrePreguntaEstadoFiltro = "POR_RESPONDER" | "RESPONDIDAS";
export type MercadoLibrePreguntaOrden = "DESC" | "ASC";

export async function getMercadoLibrePreguntas(
  idCuenta: number,
  page = 1,
  limit = 50,
  estadoFiltro: MercadoLibrePreguntaEstadoFiltro = "POR_RESPONDER",
  orden: MercadoLibrePreguntaOrden = "DESC",
): Promise<MercadoLibrePreguntasResult> {
  const where = estadoFiltro === "POR_RESPONDER" ? "AND question.estado = 'UNANSWERED'" : "AND question.estado = 'ANSWERED'";
  const direction = orden === "ASC" ? "ASC" : "DESC";
  const isAnswered = estadoFiltro === "RESPONDIDAS";
  const totalResult = await query<{ total_count: number }>(
    isAnswered
      ? `SELECT COUNT(*)::int AS total_count
         FROM (
           SELECT 1
           FROM public.mercadolibre_pregunta question
           WHERE question.id_cuenta = $1 ${where}
           GROUP BY
             COALESCE(question.item_id, 'pregunta:' || question.id::text),
             COALESCE(question.comprador_id::text, 'pregunta:' || question.id::text)
         ) grupos`
      : `SELECT COUNT(*)::int AS total_count FROM public.mercadolibre_pregunta question WHERE question.id_cuenta = $1 ${where}`,
    [idCuenta],
  );
  const totalCount = Number(totalResult.rows[0]?.total_count || 0);
  if (!totalCount) return { data: [], totalCount: 0, totalPages: 0 };
  const safePage = Math.max(1, page);
  const { rows } = await query(
    isAnswered
      ? `WITH agrupadas AS (
           SELECT
             question.*,
             COUNT(*) OVER (
               PARTITION BY
                 COALESCE(question.item_id, 'pregunta:' || question.id::text),
                 COALESCE(question.comprador_id::text, 'pregunta:' || question.id::text)
             )::int AS cantidad_conversaciones,
             ROW_NUMBER() OVER (
               PARTITION BY
                 COALESCE(question.item_id, 'pregunta:' || question.id::text),
                 COALESCE(question.comprador_id::text, 'pregunta:' || question.id::text)
               ORDER BY question.fecha ${direction} NULLS LAST, question.id ${direction}
             ) AS posicion
           FROM public.mercadolibre_pregunta question
           WHERE question.id_cuenta = $1 ${where}
         )
         SELECT question.id, question.pregunta_id, question.item_id, question.titulo, question.comprador, question.comprador_id,
           question.texto, question.estado, question.fecha, question.respuesta, question.respondida_at, question.sincronizada_at,
           question.cantidad_conversaciones,
           publication.thumbnail_url, publication.permalink, publication.seller_sku, publication.precio, publication.moneda, publication.cantidad_disponible
         FROM agrupadas question
         LEFT JOIN public.mercadolibre_publicacion publication
           ON publication.id_cuenta = question.id_cuenta AND publication.item_id = question.item_id
         WHERE question.posicion = 1
         ORDER BY question.fecha ${direction} NULLS LAST, question.id ${direction} LIMIT $2 OFFSET $3`
      : `SELECT question.id, question.pregunta_id, question.item_id, question.titulo, question.comprador, question.comprador_id,
         question.texto, question.estado, question.fecha, question.respuesta, question.respondida_at, question.sincronizada_at,
         1::int AS cantidad_conversaciones,
         publication.thumbnail_url, publication.permalink, publication.seller_sku, publication.precio, publication.moneda, publication.cantidad_disponible
       FROM public.mercadolibre_pregunta question
       LEFT JOIN public.mercadolibre_publicacion publication
         ON publication.id_cuenta = question.id_cuenta AND publication.item_id = question.item_id
       WHERE question.id_cuenta = $1 ${where}
       ORDER BY question.fecha ${direction} NULLS LAST, question.id ${direction} LIMIT $2 OFFSET $3`,
    [idCuenta, limit, (safePage - 1) * limit],
  );
  const preguntaIds = rows.map((row) => String(row.pregunta_id));
  const { rows: historyRows } = preguntaIds.length ? await query(
    `SELECT history.pregunta_id, history.item_id, history.comprador_id, history.texto, history.estado, history.fecha, history.respuesta, history.respondida_at
     FROM public.mercadolibre_pregunta history
     JOIN (
       SELECT DISTINCT item_id, comprador_id
       FROM public.mercadolibre_pregunta
       WHERE id_cuenta = $1 AND pregunta_id = ANY($2::text[]) AND comprador_id IS NOT NULL
     ) selected ON selected.item_id IS NOT DISTINCT FROM history.item_id AND selected.comprador_id = history.comprador_id
     WHERE history.id_cuenta = $1 AND NOT (history.pregunta_id = ANY($2::text[]))
     ORDER BY history.fecha DESC NULLS LAST, history.id DESC`,
    [idCuenta, preguntaIds],
  ) : { rows: [] as Array<Record<string, unknown>> };
  const previousByBuyerAndItem = new Map<string, Array<Record<string, unknown>>>();
  for (const history of historyRows) {
    const key = `${String(history.item_id || "")}|${String(history.comprador_id || "")}`;
    const values = previousByBuyerAndItem.get(key) || [];
    values.push(history);
    previousByBuyerAndItem.set(key, values);
  }
  return {
    data: rows.map((row): MercadoLibrePreguntaListado => ({
      id: Number(row.id), preguntaId: String(row.pregunta_id), itemId: row.item_id ? String(row.item_id) : null,
      titulo: row.titulo ? String(row.titulo) : null, comprador: row.comprador ? String(row.comprador) : null,
      thumbnailUrl: secureThumbnailUrl(row.thumbnail_url ? String(row.thumbnail_url) : null), permalink: row.permalink ? String(row.permalink) : null,
      sellerSku: row.seller_sku ? String(row.seller_sku) : null,
      precio: row.precio === null ? null : Number(row.precio), moneda: row.moneda ? String(row.moneda) : null,
      cantidadDisponible: row.cantidad_disponible === null ? null : Number(row.cantidad_disponible),
      compradorId: row.comprador_id === null ? null : String(row.comprador_id),
      texto: String(row.texto), estado: String(row.estado), fecha: row.fecha ? new Date(String(row.fecha)).toISOString() : null,
      respuesta: row.respuesta ? String(row.respuesta) : null,
      respondidaAt: row.respondida_at ? new Date(String(row.respondida_at)).toISOString() : null,
      sincronizadaAt: new Date(String(row.sincronizada_at)).toISOString(),
      cantidadConversaciones: Number(row.cantidad_conversaciones || 1),
      anteriores: (previousByBuyerAndItem.get(`${String(row.item_id || "")}|${String(row.comprador_id || "")}`) || []).map((history) => ({
        preguntaId: String(history.pregunta_id), texto: String(history.texto), estado: String(history.estado),
        fecha: history.fecha ? new Date(String(history.fecha)).toISOString() : null,
        respuesta: history.respuesta ? String(history.respuesta) : null,
        respondidaAt: history.respondida_at ? new Date(String(history.respondida_at)).toISOString() : null,
      })),
    })),
    totalCount,
    totalPages: Math.ceil(totalCount / limit),
  };
}

export async function getMercadoLibreVinculos(tipo: "ITEM" | "KIT", id: number) {
  const column = tipo === "KIT" ? "id_kit" : "id_producto";
  const { rows } = await query<{ id: number; item_id: string; titulo: string; estado: string; permalink: string | null; seller_sku: string | null; fecha_creacion_ml: string | null; fecha_actualizacion_ml: string | null; sincronizada_at: string }>(
    `SELECT id, item_id, titulo, estado, permalink, seller_sku,
       NULLIF(datos->>'fechaCreacionMl', '') AS fecha_creacion_ml,
       NULLIF(datos->>'fechaActualizacionMl', '') AS fecha_actualizacion_ml,
       sincronizada_at
     FROM public.mercadolibre_publicacion
     WHERE ${column} = $1
     ORDER BY estado = 'active' DESC, titulo ASC`,
    [id]
  );
  return rows.map((row) => ({
    id: Number(row.id),
    itemId: String(row.item_id),
    titulo: String(row.titulo),
    estado: String(row.estado),
    permalink: row.permalink ? String(row.permalink) : null,
    sellerSku: row.seller_sku ? String(row.seller_sku) : null,
    fechaCreacionMl: row.fecha_creacion_ml ? new Date(String(row.fecha_creacion_ml)).toISOString() : null,
    fechaActualizacionMl: row.fecha_actualizacion_ml ? new Date(String(row.fecha_actualizacion_ml)).toISOString() : null,
    sincronizadaAt: new Date(String(row.sincronizada_at)).toISOString(),
  }));
}

export async function buscarPublicacionesMercadoLibre(search: string) {
  const term = `%${search.trim()}%`;
  if (search.trim().length < 2) return [];
  const { rows } = await query<{ id: number; item_id: string; titulo: string; estado: string; permalink: string | null; seller_sku: string | null }>(
    `SELECT id, item_id, titulo, estado, permalink, seller_sku
     FROM public.mercadolibre_publicacion
     WHERE item_id ILIKE $1 OR seller_sku ILIKE $1 OR titulo ILIKE $1
     ORDER BY estado = 'active' DESC, titulo ASC
     LIMIT 30`,
    [term]
  );
  return rows.map((row) => ({
    id: Number(row.id), itemId: String(row.item_id), titulo: String(row.titulo), estado: String(row.estado),
    permalink: row.permalink ? String(row.permalink) : null, sellerSku: row.seller_sku ? String(row.seller_sku) : null,
  }));
}

export type MercadoLibreVinculoCandidato = {
  tipo: "ITEM" | "KIT";
  id: number;
  codigo: string;
  descripcion: string;
};

export async function buscarCandidatosVinculoMercadoLibre(search: string): Promise<MercadoLibreVinculoCandidato[]> {
  const normalized = search.trim();
  if (normalized.length < 2) return [];

  const term = `%${normalized}%`;
  const { rows } = await query<{ tipo: "ITEM" | "KIT"; id: number; codigo: string; descripcion: string }>(
    `WITH candidatos AS (
       SELECT 'ITEM'::text AS tipo, product.id, product.cod_unico::text AS codigo, product.descripcion::text AS descripcion
       FROM public.productos product
       WHERE COALESCE(product.oculto_por_kit, FALSE) = FALSE
         AND (product.cod_unico ILIKE $1 OR product.descripcion ILIKE $1)
       UNION ALL
       SELECT 'KIT'::text AS tipo, kit.id, kit.codigo_kit::text AS codigo, COALESCE(kit.nombre, kit.descripcion, kit.codigo_kit)::text AS descripcion
       FROM public.kits kit
       WHERE COALESCE(kit.activo, TRUE) = TRUE
         AND (kit.codigo_kit ILIKE $1 OR kit.nombre ILIKE $1 OR kit.descripcion ILIKE $1)
     )
     SELECT tipo, id, codigo, descripcion
     FROM candidatos
     ORDER BY
       CASE WHEN UPPER(codigo) = UPPER($2) THEN 0 ELSE 1 END,
       CASE WHEN UPPER(codigo) LIKE UPPER($2) || '%' THEN 0 ELSE 1 END,
       codigo ASC
     LIMIT 30`,
    [term, normalized],
  );
  return rows.map((row) => ({
    tipo: row.tipo,
    id: Number(row.id),
    codigo: String(row.codigo),
    descripcion: String(row.descripcion),
  }));
}

export async function guardarVinculoManualMercadoLibre(
  idPublicacion: number,
  target: { tipo: "ITEM" | "KIT"; id: number } | null
) {
  return withTransaction(async (db) => {
    const publication = await db.query<{ id: number; item_id: string; id_producto: number | null; id_kit: number | null }>(
      "SELECT id, item_id, id_producto, id_kit FROM public.mercadolibre_publicacion WHERE id = $1 FOR UPDATE",
      [idPublicacion]
    );
    if (!publication.rowCount) throw new AppError("La publicación no existe.", 404);

    if (!target) {
      await db.query(
        `UPDATE public.mercadolibre_publicacion
         SET id_producto = NULL, id_kit = NULL, tipo_vinculo = 'EXCLUIDO_MANUAL', updated_at = NOW()
         WHERE id = $1`,
        [idPublicacion]
      );
      return;
    }

    const table = target.tipo === "KIT" ? "kits" : "productos";
    const exists = await db.query(`SELECT id FROM public.${table} WHERE id = $1`, [target.id]);
    if (!exists.rowCount) throw new AppError(`${target.tipo === "KIT" ? "El kit" : "El item"} seleccionado ya no existe.`, 404);

    const current = publication.rows[0];
    const alreadyLinkedToTarget = target.tipo === "ITEM" ? current.id_producto === target.id : current.id_kit === target.id;
    if (!alreadyLinkedToTarget && (current.id_producto !== null || current.id_kit !== null)) {
      throw new AppError(`La PublicaciÃ³n # ${current.item_id} ya se encuentra asignada a otro ${current.id_kit !== null ? "kit" : "item"}.`, 409);
    }

    if (!alreadyLinkedToTarget) {
      const column = target.tipo === "KIT" ? "id_kit" : "id_producto";
      const linkedCount = await db.query<{ total: string }>(
        `SELECT COUNT(*)::text AS total FROM public.mercadolibre_publicacion WHERE ${column} = $1`,
        [target.id]
      );
      if (Number(linkedCount.rows[0]?.total || 0) >= 100) {
        throw new AppError("Este registro ya tiene el maximo de 100 publicaciones de Mercado Libre.", 409);
      }
    }

    await db.query(
      `UPDATE public.mercadolibre_publicacion
       SET id_producto = $2, id_kit = $3, tipo_vinculo = 'MANUAL', updated_at = NOW()
       WHERE id = $1`,
      [idPublicacion, target.tipo === "ITEM" ? target.id : null, target.tipo === "KIT" ? target.id : null]
    );
  });
}

async function actualizarSkuDeVinculoMercadoLibre(
  idPublicacion: number,
  target: { tipo: "ITEM" | "KIT"; id: number },
) {
  const publicationResult = await query<{ id_cuenta: number; item_id: string; variaciones: unknown }>(
    `SELECT id_cuenta, item_id, variaciones
     FROM public.mercadolibre_publicacion
     WHERE id = $1`,
    [idPublicacion],
  );
  const publication = publicationResult.rows[0];
  if (!publication) throw new AppError("La publicacion no existe.", 404);
  if (Array.isArray(publication.variaciones) && publication.variaciones.length > 0) {
    throw new AppError("La publicacion tiene variaciones. Vinculala sin cambiar el SKU y revisa cada variacion por separado en Mercado Libre.", 422);
  }

  const targetTable = target.tipo === "KIT" ? "kits" : "productos";
  const targetCodeColumn = target.tipo === "KIT" ? "codigo_kit" : "cod_unico";
  const targetResult = await query<{ codigo: string }>(
    `SELECT ${targetCodeColumn}::text AS codigo FROM public.${targetTable} WHERE id = $1`,
    [target.id],
  );
  const sku = targetResult.rows[0]?.codigo?.trim();
  if (!sku) throw new AppError(`El ${target.tipo === "KIT" ? "kit" : "item"} seleccionado no tiene un codigo para usar como SKU.`, 422);

  const { accessToken } = await accessTokenForCuenta(Number(publication.id_cuenta));
  await meliPut(`/items/${encodeURIComponent(String(publication.item_id))}`, Number(publication.id_cuenta), accessToken, { seller_custom_field: sku });
  await query(
    `UPDATE public.mercadolibre_publicacion
     SET seller_sku = $2, sincronizada_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [idPublicacion, sku],
  );
  return sku;
}

export async function guardarVinculoRevisadoMercadoLibre(
  idPublicacion: number,
  target: { tipo: "ITEM" | "KIT"; id: number } | null,
  actualizarSku = false,
) {
  await guardarVinculoManualMercadoLibre(idPublicacion, target);
  if (!target || !actualizarSku) return { skuActualizado: false, advertenciaSku: null };

  try {
    const sku = await actualizarSkuDeVinculoMercadoLibre(idPublicacion, target);
    return { skuActualizado: true, advertenciaSku: null, sku };
  } catch (error) {
    return {
      skuActualizado: false,
      advertenciaSku: error instanceof Error ? error.message : "El vinculo se guardo, pero no se pudo actualizar el SKU en Mercado Libre.",
    };
  }
}

async function accessTokenForCuenta(idCuenta: number, forceRefresh = false) {
  const config = getConfig();
  return withTransaction(async (db) => {
    const result = await db.query<CuentaTokenRow>(
      `SELECT id, seller_id, access_token_cifrado, refresh_token_cifrado, access_token_expira_at
       FROM public.mercadolibre_cuenta WHERE id = $1 AND conectada = TRUE FOR UPDATE`,
      [idCuenta]
    );
    const cuenta = result.rows[0];
    if (!cuenta) throw new AppError("La cuenta de Mercado Libre no esta conectada.", 404);
    const expiresAt = new Date(cuenta.access_token_expira_at).getTime();
    if (!forceRefresh && expiresAt > Date.now() + REFRESH_MARGIN_MS) {
      return { accessToken: decrypt(cuenta.access_token_cifrado, config.encryptionSecret), sellerId: Number(cuenta.seller_id) };
    }
    const renewed = await refreshToken(decrypt(cuenta.refresh_token_cifrado, config.encryptionSecret));
    const newExpiry = new Date(Date.now() + Math.max(1, Number(renewed.expires_in)) * 1000);
    await db.query(
      `UPDATE public.mercadolibre_cuenta
       SET access_token_cifrado = $2, refresh_token_cifrado = $3, access_token_expira_at = $4, updated_at = NOW()
       WHERE id = $1`,
      [idCuenta, encrypt(renewed.access_token, config.encryptionSecret), encrypt(renewed.refresh_token, config.encryptionSecret), newExpiry]
    );
    return { accessToken: renewed.access_token, sellerId: Number(cuenta.seller_id) };
  });
}

async function meliGet(path: string, idCuenta: number, token: string) {
  const request = async (accessToken: string) => fetch(`${API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    cache: "no-store",
  });
  let response = await request(token);
  if (response.status === 401) {
    const renewed = await accessTokenForCuenta(idCuenta, true);
    response = await request(renewed.accessToken);
  }
  if (!response.ok) {
    const recurso = path.startsWith("/orders") ? "ventas" : path.startsWith("/questions") ? "preguntas" : path.startsWith("/items") || path.startsWith("/users/") ? "publicaciones" : "datos";
    const details = await response.json().catch(() => null) as { message?: unknown; error?: unknown; cause?: Array<{ code?: unknown; message?: unknown }> } | null;
    const cause = details?.cause?.[0];
    const detail = typeof cause?.message === "string" ? cause.message : typeof details?.message === "string" ? details.message : typeof details?.error === "string" ? details.error : "";
    throw new AppError(`Mercado Libre rechazo el acceso a ${recurso} (${response.status})${detail ? `: ${detail}` : "."}`, response.status === 403 ? 403 : 502);
  }
  return response.json() as Promise<unknown>;
}

export async function revisarPublicacionParaDuplicar(idPublicacion: number, tipo: "ITEM" | "KIT", id: number) {
  const column = tipo === "KIT" ? "id_kit" : "id_producto";
  const result = await query<{ id_cuenta: number; item_id: string }>(
    `SELECT id_cuenta, item_id FROM public.mercadolibre_publicacion WHERE id = $1 AND ${column} = $2`,
    [idPublicacion, id],
  );
  const publication = result.rows[0];
  if (!publication) throw new AppError("La publicacion ya no esta vinculada a este item o grupo.", 404);
  const idCuenta = Number(publication.id_cuenta);
  const { accessToken, sellerId } = await accessTokenForCuenta(idCuenta);
  const itemId = encodeURIComponent(publication.item_id);
  const item = await meliGet(`/items/${itemId}`, idCuenta, accessToken) as Record<string, unknown>;
  if (Number(item.seller_id) !== sellerId) throw new AppError("La publicacion no pertenece a la cuenta conectada.", 403);
  const compatibilities = await Promise.allSettled([
    meliGet(`/items/${itemId}/description`, idCuenta, accessToken),
    meliGet(`/items/${itemId}/compatibilities?limit=50`, idCuenta, accessToken),
    meliGet(`/users/${sellerId}`, idCuenta, accessToken),
  ]);
  const description = compatibilities[0].status === "fulfilled" ? compatibilities[0].value as Record<string, unknown> : null;
  const compat = compatibilities[1].status === "fulfilled" ? compatibilities[1].value as Record<string, unknown> : null;
  const seller = compatibilities[2].status === "fulfilled" ? compatibilities[2].value as Record<string, unknown> : null;
  const products = Array.isArray(compat?.products) ? compat.products as Array<Record<string, unknown>> : [];
  const paging = compat?.paging && typeof compat.paging === "object" ? compat.paging as Record<string, unknown> : null;
  const shipping = item.shipping && typeof item.shipping === "object" ? item.shipping as Record<string, unknown> : null;
  return {
    itemId: publication.item_id,
    titulo: String(item.title || ""),
    estado: String(item.status || ""),
    categoria: String(item.category_id || ""),
    userProductId: typeof item.user_product_id === "string" ? item.user_product_id : null,
    userProductSeller: Array.isArray(seller?.tags) ? seller.tags.includes("user_product_seller") : null,
    sku: itemSku(item as MeliItem),
    precio: typeof item.price === "number" ? item.price : null,
    moneda: String(item.currency_id || ""),
    stock: typeof item.available_quantity === "number" ? item.available_quantity : null,
    fotos: Array.isArray(item.pictures) ? item.pictures.length : null,
    envio: {
      modalidad: typeof shipping?.mode === "string" ? shipping.mode : null,
      gratis: typeof shipping?.free_shipping === "boolean" ? shipping.free_shipping : null,
      retiro: typeof shipping?.local_pick_up === "boolean" ? shipping.local_pick_up : null,
    },
    descripcionDisponible: description === null ? null : Boolean(description.plain_text || description.text),
    descripcionTexto: typeof description?.plain_text === "string" ? description.plain_text : "",
    compatibilidades: compat === null ? null : {
      total: typeof paging?.total === "number" ? paging.total : null,
      muestras: products.length,
      vendedor: products.filter((product) => product.source === "SELLER").length,
      catalogo: products.filter((product) => product.source === "CATALOGO").reduce((sum, product) => sum + (Number(product.total) || 1), 0),
      sinOrigen: products.filter((product) => product.source !== "SELLER" && product.source !== "CATALOGO").length,
    },
  };
}

export async function validarPublicacionParaDuplicar(idPublicacion: number, tipo: "ITEM" | "KIT", id: number, nombre: string) {
  const column = tipo === "KIT" ? "id_kit" : "id_producto";
  const result = await query<{ id_cuenta: number; item_id: string }>(
    `SELECT id_cuenta, item_id FROM public.mercadolibre_publicacion WHERE id = $1 AND ${column} = $2`,
    [idPublicacion, id],
  );
  const publication = result.rows[0];
  if (!publication) throw new AppError("La publicacion ya no esta vinculada a este item o grupo.", 404);
  const idCuenta = Number(publication.id_cuenta);
  const { accessToken, sellerId } = await accessTokenForCuenta(idCuenta);
  const item = await meliGet(`/items/${encodeURIComponent(publication.item_id)}`, idCuenta, accessToken) as Record<string, unknown>;
  if (Number(item.seller_id) !== sellerId) throw new AppError("La publicacion no pertenece a la cuenta conectada.", 403);
  let body: Record<string, unknown>;
  try { body = prepararValidacionPublicacion(item, nombre); }
  catch (error) { throw new AppError(error instanceof Error ? error.message : "No se pudo preparar la validacion.", 400); }
  const request = (token: string) => fetch(`${API_BASE_URL}/items/validate`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body), cache: "no-store",
  });
  const tokens = [accessToken];
  let response = await request(accessToken);
  if (response.status === 401) {
    const renewed = await accessTokenForCuenta(idCuenta, true);
    tokens.push(renewed.accessToken);
    response = await request(renewed.accessToken);
  }
  const responseText = await response.text();
  let data: unknown = null;
  if (responseText) {
    try { data = JSON.parse(responseText); }
    catch { data = responseText; }
  }
  const safeData = protegerDiagnostico(data, tokens);
  return {
    ...interpretarValidacionPublicacion(response.status, safeData),
    diagnostico: { metodo: "POST", recurso: "/items/validate", publicacionOrigen: publication.item_id,
      solicitud: protegerDiagnostico(body, tokens), estadoHttp: response.status, respuesta: safeData },
  };
}

export async function probarCreacionPublicacion(idPublicacion: number, tipo: "ITEM" | "KIT", id: number, nombre: string, descripcion: string) {
  const column = tipo === "KIT" ? "id_kit" : "id_producto";
  const result = await query<{ id_cuenta: number; item_id: string }>(
    `SELECT id_cuenta, item_id FROM public.mercadolibre_publicacion WHERE id = $1 AND ${column} = $2`,
    [idPublicacion, id],
  );
  const publication = result.rows[0];
  if (!publication) throw new AppError("La publicacion ya no esta vinculada a este item o grupo.", 404);
  const idCuenta = Number(publication.id_cuenta);
  const { accessToken, sellerId } = await accessTokenForCuenta(idCuenta);
  const item = await meliGet(`/items/${encodeURIComponent(publication.item_id)}`, idCuenta, accessToken) as Record<string, unknown>;
  if (Number(item.seller_id) !== sellerId) throw new AppError("La publicacion no pertenece a la cuenta conectada.", 403);
  const body = prepararValidacionPublicacion(item, nombre);
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/items`, {
      method: "POST", headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body), cache: "no-store",
    });
  } catch {
    return { resultado: "INCIERTO", mensaje: "No se recibio respuesta de Mercado Libre. Antes de volver a intentar, revisa si se creo la publicacion en la cuenta." };
  }
  const data = await response.json().catch(() => null) as Record<string, unknown> | null;
  const safeData = protegerDiagnostico(data, [accessToken]);
  if (response.ok && typeof data?.id === "string") {
    let descripcionEstado = "SIN_DESCRIPCION";
    if (descripcion.trim()) {
      try {
        const descriptionResponse = await fetch(`${API_BASE_URL}/items/${encodeURIComponent(data.id)}/description`, {
          method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ plain_text: descripcion }), cache: "no-store",
        });
        descripcionEstado = descriptionResponse.ok ? "GUARDADA" : "ERROR";
      } catch { descripcionEstado = "INCIERTA"; }
    }
    return { resultado: "CREADA", publicacion: data.id, titulo: typeof data.title === "string" ? data.title : null, userProductId: typeof data.user_product_id === "string" ? data.user_product_id : null, estado: typeof data.status === "string" ? data.status : null, descripcionEstado };
  }
  if (response.status >= 500 || response.ok) {
    return { resultado: "INCIERTO", status: response.status, mensaje: "Mercado Libre no confirmo el resultado. Revisa la cuenta antes de volver a intentar.", respuesta: safeData };
  }
  return { resultado: "RECHAZADA", status: response.status, respuesta: safeData };
}

async function meliPost(path: string, idCuenta: number, token: string, body: Record<string, unknown>) {
  const request = async (accessToken: string) => fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  let response = await request(token);
  if (response.status === 401) {
    const renewed = await accessTokenForCuenta(idCuenta, true);
    response = await request(renewed.accessToken);
  }
  if (!response.ok) {
    const details = await response.json().catch(() => null) as { message?: unknown } | null;
    const message = typeof details?.message === "string" ? ` ${details.message}` : "";
    throw new AppError(`Mercado Libre no pudo completar la respuesta (${response.status}).${message}`, response.status === 403 ? 403 : 502);
  }
  return response.json() as Promise<unknown>;
}

async function meliPut(path: string, idCuenta: number, token: string, body: Record<string, unknown>) {
  const request = async (accessToken: string) => fetch(`${API_BASE_URL}${path}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  let response = await request(token);
  if (response.status === 401) {
    const renewed = await accessTokenForCuenta(idCuenta, true);
    response = await request(renewed.accessToken);
  }
  if (!response.ok) {
    const details = await response.json().catch(() => null) as { message?: unknown; error?: unknown } | null;
    const detail = typeof details?.message === "string" ? details.message : typeof details?.error === "string" ? details.error : "";
    throw new AppError(`Mercado Libre no pudo actualizar la publicacion (${response.status})${detail ? `: ${detail}` : "."}`, response.status === 403 ? 403 : 502);
  }
  return response.json() as Promise<unknown>;
}

export async function encolarActualizacionesPrecioMercadoLibre(productIds: number[], kitIds: number[]) {
  const products = [...new Set(productIds.filter((id) => Number.isInteger(id) && id > 0))];
  const kits = [...new Set(kitIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (!products.length && !kits.length) return 0;
  const result = await query(
    `WITH tipo_ml AS (
       SELECT id FROM public.tipo_precio WHERE upper(trim(descripcion)) = 'MERCADO LIBRE' ORDER BY id LIMIT 1
     ), kits_afectados AS (
       SELECT UNNEST($2::int[]) AS id_kit
       UNION
       SELECT detalle.id_kit FROM public.kit_detalle detalle WHERE detalle.id_producto = ANY($1::int[])
     ), objetivos AS (
       SELECT publication.id AS id_publicacion, precio.precio
       FROM public.mercadolibre_publicacion publication
       INNER JOIN public.producto_precio precio ON precio.id_producto = publication.id_producto
       CROSS JOIN tipo_ml
       WHERE publication.estado IN ('active', 'paused') AND precio.id_tipo_precio = tipo_ml.id
         AND publication.id_producto = ANY($1::int[]) AND precio.precio > 0
       UNION ALL
       SELECT publication.id AS id_publicacion,
         CASE WHEN kit.criterio_costo = 'MANUAL' THEN manual.precio ELSE COALESCE(SUM(componente.precio * detalle.cantidad), 0) END AS precio
       FROM public.mercadolibre_publicacion publication
       INNER JOIN public.kits kit ON kit.id = publication.id_kit
       LEFT JOIN public.kit_precio manual ON manual.id_kit = kit.id AND manual.id_tipo_precio = (SELECT id FROM tipo_ml)
       LEFT JOIN public.kit_detalle detalle ON detalle.id_kit = kit.id
       LEFT JOIN public.producto_precio componente ON componente.id_producto = detalle.id_producto AND componente.id_tipo_precio = (SELECT id FROM tipo_ml)
       WHERE publication.estado IN ('active', 'paused') AND publication.id_kit IN (SELECT id_kit FROM kits_afectados)
       GROUP BY publication.id, kit.id, kit.criterio_costo, manual.precio
     )
     INSERT INTO public.mercadolibre_actualizacion_precio (id_publicacion, precio, estado, intentos, ultimo_error, created_at, updated_at)
     SELECT id_publicacion, ROUND(precio, 2), 'PENDIENTE', 0, NULL, NOW(), NOW()
     FROM objetivos WHERE precio > 0
     ON CONFLICT (id_publicacion) DO UPDATE SET precio = EXCLUDED.precio, estado = 'PENDIENTE', intentos = 0,
       ultimo_error = NULL, procesado_at = NULL, updated_at = NOW()`,
    [products, kits]
  );
  return result.rowCount ?? 0;
}

type PrecioPendiente = { id: number; id_publicacion: number; precio: number; id_cuenta: number; item_id: string };

/** Procesa una tanda acotada; el cron externo la vuelve a ejecutar en el siguiente ciclo. */
export async function procesarActualizacionesPrecioMercadoLibre(limit = 20) {
  const jobs = await withTransaction(async (db) => {
    const claimed = await db.query<PrecioPendiente>(
      `WITH pendientes AS (
         SELECT queue.id
         FROM public.mercadolibre_actualizacion_precio queue
         WHERE queue.estado IN ('PENDIENTE', 'ERROR') AND queue.intentos < 3
         ORDER BY queue.updated_at ASC, queue.id ASC
         LIMIT $1
         FOR UPDATE SKIP LOCKED
       )
       UPDATE public.mercadolibre_actualizacion_precio queue
       SET estado = 'PROCESANDO', intentos = queue.intentos + 1, updated_at = NOW()
       FROM pendientes, public.mercadolibre_publicacion publication
       WHERE queue.id = pendientes.id AND publication.id = queue.id_publicacion
       RETURNING queue.id, queue.id_publicacion, queue.precio, publication.id_cuenta, publication.item_id`,
      [Math.max(1, Math.min(50, Math.floor(limit) || 20))]
    );
    return claimed.rows;
  });

  let actualizadas = 0;
  let errores = 0;
  for (const job of jobs) {
    try {
      const { accessToken } = await accessTokenForCuenta(Number(job.id_cuenta));
      await meliPut(`/items/${encodeURIComponent(String(job.item_id))}`, Number(job.id_cuenta), accessToken, { price: Number(job.precio) });
      await query(
        `UPDATE public.mercadolibre_actualizacion_precio
         SET estado = 'COMPLETADA', ultimo_error = NULL, procesado_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [job.id]
      );
      await query(
        `UPDATE public.mercadolibre_publicacion SET precio = $2, updated_at = NOW() WHERE id = $1`,
        [job.id_publicacion, job.precio]
      );
      actualizadas += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 900) : "No se pudo actualizar el precio.";
      await query(
        `UPDATE public.mercadolibre_actualizacion_precio
         SET estado = 'ERROR', ultimo_error = $2, updated_at = NOW() WHERE id = $1`,
        [job.id, message]
      );
      errores += 1;
    }
  }
  return { procesadas: jobs.length, actualizadas, errores };
}

function toFiniteNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function secureThumbnailUrl(value: string | null | undefined) {
  const url = String(value || "").trim();
  return url ? url.replace(/^http:\/\//i, "https://") : null;
}

function shippingWeight(dimensions: string | null | undefined) {
  const value = String(dimensions || "").split(",").at(-1)?.trim() || "";
  return /^\d+(?:[.,]\d+)?$/.test(value) ? value.replace(",", ".") : null;
}

function shippingEstimate(payload: unknown) {
  if (!payload || typeof payload !== "object") return { costo: null, pesoFacturable: null };
  const source = payload as {
    coverage?: { all_country?: { list_cost?: unknown; billable_weight?: unknown } };
    list_cost?: unknown;
    billable_weight?: unknown;
  };
  const coverage = source.coverage?.all_country;
  return {
    costo: toFiniteNumber(coverage?.list_cost ?? source.list_cost),
    pesoFacturable: toFiniteNumber(coverage?.billable_weight ?? source.billable_weight),
  };
}

export async function actualizarCostoEstimadoMercadoLibre(idCuenta: number, itemId: string): Promise<MercadoLibreCostoEstimado> {
  const publicacion = await query<{
    item_id: string; precio: number | null; moneda: string | null; categoria_id: string | null; tipo_publicacion: string | null;
  }>(
    `SELECT item_id, precio, moneda, categoria_id, tipo_publicacion
     FROM public.mercadolibre_publicacion WHERE id_cuenta = $1 AND item_id = $2 LIMIT 1`,
    [idCuenta, itemId],
  );
  const stored = publicacion.rows[0];
  if (!stored) throw new AppError("La publicacion no pertenece a esta cuenta de Mercado Libre.", 404);

  const { accessToken, sellerId } = await accessTokenForCuenta(idCuenta);
  const account = await query<{ site_id: string }>("SELECT site_id FROM public.mercadolibre_cuenta WHERE id = $1", [idCuenta]);
  const siteId = String(account.rows[0]?.site_id || "MLA");
  const item = await meliGet(`/items/${encodeURIComponent(itemId)}`, idCuenta, accessToken) as MeliItem;
  const precio = toFiniteNumber(item.price) ?? toFiniteNumber(stored.precio);
  const moneda = String(item.currency_id || stored.moneda || "ARS");
  const categoriaId = item.category_id || stored.categoria_id || null;
  const tipoPublicacion = item.listing_type_id || stored.tipo_publicacion || null;
  if (precio === null || precio <= 0 || !tipoPublicacion) {
    throw new AppError("La publicacion no tiene precio o tipo de publicacion suficientes para calcular sus costos.", 422);
  }

  const pricingParams = new URLSearchParams({
    price: String(precio),
    currency_id: moneda,
    listing_type_id: tipoPublicacion,
  });
  if (categoriaId) pricingParams.set("category_id", categoriaId);
  if (item.shipping?.logistic_type) pricingParams.set("logistic_type", item.shipping.logistic_type);
  if (item.shipping?.mode) pricingParams.set("shipping_mode", item.shipping.mode);
  const weight = shippingWeight(item.shipping?.dimensions);
  if (weight) pricingParams.set("billable_weight", weight);

  const pricingPayload = await meliGet(`/sites/${siteId}/listing_prices?${pricingParams.toString()}`, idCuenta, accessToken);
  const pricing = (Array.isArray(pricingPayload) ? pricingPayload[0] : pricingPayload) as {
    sale_fee_amount?: unknown;
    sale_fee_details?: { percentage_fee?: unknown; fixed_fee?: unknown; financing_add_on_fee?: unknown };
  } | undefined;
  if (!pricing) throw new AppError("Mercado Libre no devolvio un calculo de costos para esta publicacion.", 502);

  const advertencias: string[] = [];
  let envioEstimado: number | null = null;
  let pesoFacturable: number | null = null;
  try {
    // Mercado Libre can resolve an active listing's logistics from its item ID.
    const shippingParams = new URLSearchParams({
      item_id: item.id,
      verbose: "true",
      item_price: String(precio),
      listing_type_id: tipoPublicacion,
      condition: item.condition || "new",
      free_shipping: String(Boolean(item.shipping?.free_shipping)),
    });
    if (item.shipping?.dimensions) shippingParams.set("dimensions", item.shipping.dimensions);
    if (item.shipping?.mode) shippingParams.set("mode", item.shipping.mode);
    if (item.shipping?.logistic_type) shippingParams.set("logistic_type", item.shipping.logistic_type);
    const shippingPayload = await meliGet(`/users/${sellerId}/shipping_options/free?${shippingParams.toString()}`, idCuenta, accessToken);
    const estimate = shippingEstimate(shippingPayload);
    envioEstimado = estimate.costo;
    pesoFacturable = estimate.pesoFacturable;
    if (envioEstimado === null) advertencias.push("Mercado Libre no devolvio un costo estimado de envio.");
  } catch {
    advertencias.push("Mercado Libre no pudo estimar el envio de esta publicacion.");
  }

  const comisionTotal = toFiniteNumber(pricing.sale_fee_amount);
  const cargoFijo = toFiniteNumber(pricing.sale_fee_details?.fixed_fee);
  const cargoFinanciacion = toFiniteNumber(pricing.sale_fee_details?.financing_add_on_fee);
  const porcentajeComision = toFiniteNumber(pricing.sale_fee_details?.percentage_fee);
  const costoMlTotal = comisionTotal === null ? null : comisionTotal + (envioEstimado || 0);
  const consultadoAt = new Date().toISOString();
  const result: MercadoLibreCostoEstimado = {
    itemId, precio, moneda, tipoPublicacion, categoriaId, comisionTotal, porcentajeComision, cargoFijo,
    cargoFinanciacion, envioEstimado, dimensionesEnvio: item.shipping?.dimensions || null, pesoFacturable, costoMlTotal,
    netoEstimado: costoMlTotal === null ? null : precio - costoMlTotal,
    advertencias, consultadoAt,
  };
  await query(
    `UPDATE public.mercadolibre_publicacion
     SET costo_estimado = $3::jsonb, costo_estimado_at = NOW(), updated_at = NOW()
     WHERE id_cuenta = $1 AND item_id = $2`,
    [idCuenta, itemId, JSON.stringify(result)],
  );
  return result;
}

export async function actualizarCostosEstimadosMercadoLibreLote(idCuenta: number, itemIds: string[]) {
  const pendientes = Array.from(new Set(itemIds.map((itemId) => itemId.trim()).filter(Boolean))).slice(0, 50);
  const calculados: MercadoLibreCostoEstimado[] = [];
  const errores: Array<{ itemId: string; mensaje: string }> = [];
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < pendientes.length) {
      const itemId = pendientes[nextIndex++];
      try {
        calculados.push(await actualizarCostoEstimadoMercadoLibre(idCuenta, itemId));
      } catch (error) {
        errores.push({ itemId, mensaje: error instanceof Error ? error.message : "No se pudo calcular el costo." });
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(4, pendientes.length) }, () => worker()));
  return { calculados, errores };
}

type CostoSincronizacionRow = {
  id: number;
  id_cuenta: number;
  estado: "EN_PROCESO" | "COMPLETADA";
  incluye_pausadas: boolean;
  total: number;
  procesadas: number;
  calculadas: number;
  fallidas: number;
  ultimo_publicacion_id: number | null;
  errores: unknown;
  iniciada_at: string;
  finalizada_at: string | null;
};

const COSTOS_MASIVOS_LOTE = 20;
const COSTOS_MASIVOS_ERRORES_MAXIMOS = 100;

function mapCostoSincronizacion(row: CostoSincronizacionRow): MercadoLibreCostoSincronizacion {
  const errores = Array.isArray(row.errores) ? row.errores : [];
  return {
    id: Number(row.id), idCuenta: Number(row.id_cuenta), estado: row.estado,
    incluyePausadas: Boolean(row.incluye_pausadas), total: Number(row.total), procesadas: Number(row.procesadas),
    calculadas: Number(row.calculadas), fallidas: Number(row.fallidas),
    errores: errores.slice(0, COSTOS_MASIVOS_ERRORES_MAXIMOS).flatMap((error) => {
      if (!error || typeof error !== "object") return [];
      const value = error as { itemId?: unknown; mensaje?: unknown };
      return typeof value.itemId === "string" && typeof value.mensaje === "string" ? [{ itemId: value.itemId, mensaje: value.mensaje }] : [];
    }),
    iniciadaAt: new Date(row.iniciada_at).toISOString(),
    finalizadaAt: row.finalizada_at ? new Date(row.finalizada_at).toISOString() : null,
  };
}

export async function getCostoSincronizacionMercadoLibre(idCuenta: number) {
  const result = await query<CostoSincronizacionRow>(
    `SELECT * FROM public.mercadolibre_costo_sincronizacion
     WHERE id_cuenta = $1 ORDER BY iniciada_at DESC LIMIT 1`,
    [idCuenta],
  );
  return result.rows[0] ? mapCostoSincronizacion(result.rows[0]) : null;
}

export async function iniciarCostoSincronizacionMercadoLibre(idCuenta: number, incluirPausadas = false) {
  return withTransaction(async (db) => {
    const existing = await db.query<CostoSincronizacionRow>(
      `SELECT * FROM public.mercadolibre_costo_sincronizacion
       WHERE id_cuenta = $1 AND estado = 'EN_PROCESO' AND incluye_pausadas = $2
       ORDER BY iniciada_at DESC LIMIT 1 FOR UPDATE`,
      [idCuenta, incluirPausadas],
    );
    if (existing.rows[0]) return mapCostoSincronizacion(existing.rows[0]);

    const total = await db.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM public.mercadolibre_publicacion
       WHERE id_cuenta = $1 AND ($2::boolean OR estado = 'active')`,
      [idCuenta, incluirPausadas],
    );
    const created = await db.query<CostoSincronizacionRow>(
      `INSERT INTO public.mercadolibre_costo_sincronizacion (id_cuenta, incluye_pausadas, total, estado)
       VALUES ($1, $2, $3, 'EN_PROCESO') RETURNING *`,
      [idCuenta, incluirPausadas, Number(total.rows[0]?.total || 0)],
    );
    return mapCostoSincronizacion(created.rows[0]);
  });
}

export async function procesarCostoSincronizacionMercadoLibre(idCuenta: number) {
  const current = await query<CostoSincronizacionRow>(
    `SELECT * FROM public.mercadolibre_costo_sincronizacion
     WHERE id_cuenta = $1 AND estado = 'EN_PROCESO' ORDER BY iniciada_at DESC LIMIT 1`,
    [idCuenta],
  );
  const job = current.rows[0];
  if (!job) return getCostoSincronizacionMercadoLibre(idCuenta);

  const publications = await query<{ id: number; item_id: string }>(
    `SELECT id, item_id FROM public.mercadolibre_publicacion
     WHERE id_cuenta = $1
       AND ($2::boolean OR estado = 'active')
       AND id > COALESCE($3::bigint, 0)
     ORDER BY id ASC LIMIT $4`,
    [idCuenta, job.incluye_pausadas, job.ultimo_publicacion_id, COSTOS_MASIVOS_LOTE],
  );
  if (!publications.rows.length) {
    const completed = await query<CostoSincronizacionRow>(
      `UPDATE public.mercadolibre_costo_sincronizacion
       SET estado = 'COMPLETADA', finalizada_at = NOW(), updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [job.id],
    );
    return mapCostoSincronizacion(completed.rows[0]);
  }

  const resultado = await actualizarCostosEstimadosMercadoLibreLote(idCuenta, publications.rows.map((row) => row.item_id));
  const erroresPrevios = Array.isArray(job.errores) ? job.errores : [];
  const errores = [...erroresPrevios, ...resultado.errores].slice(-COSTOS_MASIVOS_ERRORES_MAXIMOS);
  const procesadas = Number(job.procesadas) + publications.rows.length;
  const updated = await query<CostoSincronizacionRow>(
    `UPDATE public.mercadolibre_costo_sincronizacion
     SET procesadas = $2, calculadas = calculadas + $3, fallidas = fallidas + $4,
         ultimo_publicacion_id = $5, errores = $6::jsonb,
         estado = CASE WHEN $2 >= total THEN 'COMPLETADA' ELSE 'EN_PROCESO' END,
         finalizada_at = CASE WHEN $2 >= total THEN NOW() ELSE NULL END,
         updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [job.id, procesadas, resultado.calculados.length, resultado.errores.length,
      publications.rows.at(-1)?.id || null, JSON.stringify(errores)],
  );
  return mapCostoSincronizacion(updated.rows[0]);
}

async function getAllItemIds(idCuenta: number, sellerId: number, accessToken: string) {
  const ids: string[] = [];
  let scrollId: string | null = null;
  for (let page = 0; page < 500; page += 1) {
    const search = new URLSearchParams({ search_type: "scan", limit: "100" });
    if (scrollId) search.set("scroll_id", scrollId);
    const payload = await meliGet(`/users/${sellerId}/items/search?${search.toString()}`, idCuenta, accessToken) as { results?: unknown[]; scroll_id?: string | null };
    const pageIds = (payload.results || []).map(String).filter(Boolean);
    ids.push(...pageIds);
    if (ids.length > MAX_SYNC_ITEMS) throw new AppError("La cuenta supera el limite de 25.000 publicaciones por sincronizacion.", 422);
    if (!pageIds.length || !payload.scroll_id) break;
    scrollId = payload.scroll_id;
  }
  return Array.from(new Set(ids));
}

async function getRecentItemIds(idCuenta: number, sellerId: number, accessToken: string, limit = 100) {
  const search = new URLSearchParams({
    limit: String(Math.max(1, Math.min(100, Math.floor(limit) || 100))),
    orders: "start_time_desc",
  });
  const payload = await meliGet(`/users/${sellerId}/items/search?${search.toString()}`, idCuenta, accessToken) as { results?: unknown[] };
  return Array.from(new Set((payload.results || []).map(String).filter(Boolean)));
}

function itemSku(item: MeliItem) {
  const attributeSku = item.attributes?.find((attribute) => attribute.id === "SELLER_SKU" || attribute.id === "SELLER_CUSTOM_FIELD")?.value_name;
  const variationSku = item.variations?.map((variation) => {
    const attributes = Array.isArray(variation.attributes) ? variation.attributes as Array<{ id?: string; value_name?: string | null }> : [];
    return String(variation.seller_custom_field || attributes.find((attribute) => attribute.id === "SELLER_SKU")?.value_name || "").trim();
  }).find(Boolean);
  return String(item.seller_custom_field || attributeSku || variationSku || "").trim() || null;
}

function mapPublicacion(item: MeliItem): MercadoLibrePublicacion {
  return {
    itemId: String(item.id), sellerSku: itemSku(item), titulo: item.title?.trim() || String(item.id), estado: item.status?.trim() || "unknown",
    categoriaId: item.category_id || null, tipoPublicacion: item.listing_type_id || null,
    precio: Number.isFinite(Number(item.price)) ? Number(item.price) : null,
    precioOriginal: item.original_price === null || item.original_price === undefined ? null : Number(item.original_price),
    moneda: item.currency_id || null,
    cantidadDisponible: Number.isFinite(Number(item.available_quantity)) ? Number(item.available_quantity) : null,
    cantidadVendida: Number.isFinite(Number(item.sold_quantity)) ? Number(item.sold_quantity) : null,
    thumbnailUrl: secureThumbnailUrl(item.thumbnail), permalink: item.permalink || null, variaciones: item.variations || [],
    fechaCreacionMl: item.date_created || null,
    fechaActualizacionMl: item.last_updated || null,
  };
}

async function guardarPublicacionesMercadoLibre(idCuenta: number, items: MeliItem[]) {
  const publications = items.map(mapPublicacion);
  const codes = publications.map((item) => normalizeMatchingCode(item.sellerSku)).filter(Boolean);
  const [products, kits] = await Promise.all([productIdsByCode(codes), kitIdsByCode(codes)]);
  let linked = 0;

  for (const item of publications) {
    const code = normalizeMatchingCode(item.sellerSku);
    const candidateProductId = code ? products.get(code) || null : null;
    const candidateKitId = code ? kits.get(code) || null : null;
    const productId = candidateProductId && !candidateKitId ? candidateProductId : null;
    const kitId = candidateKitId && !candidateProductId ? candidateKitId : null;
    if (productId || kitId) linked += 1;
    await query(
      `INSERT INTO public.mercadolibre_publicacion (
        id_cuenta, item_id, id_producto, id_kit, tipo_vinculo, seller_sku, titulo, estado, categoria_id, tipo_publicacion,
        precio, precio_original, moneda, cantidad_disponible, cantidad_vendida, thumbnail_url, permalink, variaciones, datos,
        ultima_vez_vista_at, sincronizada_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18::jsonb, $19::jsonb, NOW(), NOW(), NOW())
      ON CONFLICT (id_cuenta, item_id) DO UPDATE SET
        id_producto = CASE WHEN mercadolibre_publicacion.tipo_vinculo IN ('MANUAL', 'EXCLUIDO_MANUAL') THEN mercadolibre_publicacion.id_producto ELSE EXCLUDED.id_producto END,
        id_kit = CASE WHEN mercadolibre_publicacion.tipo_vinculo IN ('MANUAL', 'EXCLUIDO_MANUAL') THEN mercadolibre_publicacion.id_kit ELSE EXCLUDED.id_kit END,
        tipo_vinculo = CASE WHEN mercadolibre_publicacion.tipo_vinculo IN ('MANUAL', 'EXCLUIDO_MANUAL') THEN mercadolibre_publicacion.tipo_vinculo ELSE EXCLUDED.tipo_vinculo END,
        seller_sku = EXCLUDED.seller_sku, titulo = EXCLUDED.titulo, estado = EXCLUDED.estado, categoria_id = EXCLUDED.categoria_id,
        tipo_publicacion = EXCLUDED.tipo_publicacion, precio = EXCLUDED.precio, precio_original = EXCLUDED.precio_original,
        moneda = EXCLUDED.moneda, cantidad_disponible = EXCLUDED.cantidad_disponible, cantidad_vendida = EXCLUDED.cantidad_vendida,
        thumbnail_url = EXCLUDED.thumbnail_url, permalink = EXCLUDED.permalink, variaciones = EXCLUDED.variaciones,
        datos = EXCLUDED.datos, ultima_vez_vista_at = NOW(), sincronizada_at = NOW(), updated_at = NOW()`,
      [idCuenta, item.itemId, productId, kitId, productId || kitId ? "CODIGO_EXACTO" : "SIN_VINCULO", item.sellerSku, item.titulo, item.estado,
        item.categoriaId, item.tipoPublicacion, item.precio, item.precioOriginal, item.moneda, item.cantidadDisponible,
        item.cantidadVendida, item.thumbnailUrl, item.permalink, JSON.stringify(item.variaciones), JSON.stringify(item)]
    );
  }

  return { total: publications.length, vinculadasPorCodigo: linked, sinVinculo: publications.length - linked };
}

async function getItemDetails(itemIds: string[], idCuenta: number, accessToken: string) {
  const items: MeliItem[] = [];
  const errors: string[] = [];
  for (let offset = 0; offset < itemIds.length; offset += ITEM_BATCH_SIZE) {
    const batch = itemIds.slice(offset, offset + ITEM_BATCH_SIZE);
    const payload = await meliGet(`/items/bulk?ids=${encodeURIComponent(batch.join(","))}`, idCuenta, accessToken) as Array<{ status_code?: number; body?: MeliItem }>;
    for (const result of payload) {
      if (result.status_code && result.status_code >= 300 || !result.body?.id) {
        if (errors.length < 50) errors.push("Una publicacion no pudo leerse desde Mercado Libre.");
        continue;
      }
      items.push(result.body);
    }
  }
  return { items, errors };
}

/** Sincroniza una tanda corta y descubre publicaciones nuevas para cron externos. */
export async function sincronizarMercadoLibreLote(idCuenta: number, requestedLimit = 500) {
  const limit = Math.max(1, Math.min(500, Math.floor(requestedLimit) || 500));
  const { accessToken, sellerId } = await accessTokenForCuenta(idCuenta);
  await query(
    `UPDATE public.mercadolibre_cuenta
     SET ultimo_estado_sincronizacion = 'EN_PROCESO', ultimo_error_sincronizacion = NULL, updated_at = NOW()
     WHERE id = $1`,
    [idCuenta]
  );
  const run = await query<{ id: number }>("INSERT INTO public.mercadolibre_sincronizacion (id_cuenta) VALUES ($1) RETURNING id", [idCuenta]);
  const runId = Number(run.rows[0].id);

  try {
    // The webhook is the primary source of changes. This small newest-first scan is
    // a fallback for publications created while a notification is delayed or lost.
    const recentIds = await getRecentItemIds(idCuenta, sellerId, accessToken);
    const existingRecent = recentIds.length
      ? await query<{ item_id: string }>(
        "SELECT item_id FROM public.mercadolibre_publicacion WHERE id_cuenta = $1 AND item_id = ANY($2::text[])",
        [idCuenta, recentIds],
      )
      : { rows: [] as Array<{ item_id: string }> };
    const knownRecentIds = new Set(existingRecent.rows.map((row) => String(row.item_id)));
    const newItemIds = recentIds.filter((itemId) => !knownRecentIds.has(itemId));
    const discovered = newItemIds.length
      ? await getItemDetails(newItemIds, idCuenta, accessToken)
      : { items: [] as MeliItem[], errors: [] as string[] };
    const savedDiscovered = await guardarPublicacionesMercadoLibre(idCuenta, discovered.items);

    const selected = await query<{ item_id: string }>(
      `SELECT item_id
       FROM public.mercadolibre_publicacion
       WHERE id_cuenta = $1
       ORDER BY sincronizada_at ASC NULLS FIRST, id ASC
       LIMIT $2`,
      [idCuenta, limit]
    );

    const { items, errors } = selected.rowCount
      ? await getItemDetails(selected.rows.map((row) => String(row.item_id)), idCuenta, accessToken)
      : { items: [] as MeliItem[], errors: [] as string[] };
    const saved = await guardarPublicacionesMercadoLibre(idCuenta, items);
    const total = savedDiscovered.total + saved.total;
    const vinculadasPorCodigo = savedDiscovered.vinculadasPorCodigo + saved.vinculadasPorCodigo;
    const sinVinculo = savedDiscovered.sinVinculo + saved.sinVinculo;
    const syncErrors = [...discovered.errors, ...errors];
    await query(
      `UPDATE public.mercadolibre_sincronizacion
       SET estado = 'OK', total_publicaciones = $2, vinculadas_por_codigo = $3, sin_vinculo = $4,
         errores = $5::jsonb, error_count = $6, finished_at = NOW()
       WHERE id = $1`,
      [runId, total, vinculadasPorCodigo, sinVinculo, JSON.stringify(syncErrors), syncErrors.length]
    );
    await query(
      `UPDATE public.mercadolibre_cuenta
       SET ultima_sincronizacion_at = NOW(), ultimo_estado_sincronizacion = 'OK', ultimo_error_sincronizacion = NULL, updated_at = NOW()
       WHERE id = $1`,
      [idCuenta]
    );
    return {
      total,
      vinculadasPorCodigo,
      sinVinculo,
      descubiertas: savedDiscovered.total,
      solicitadas: newItemIds.length + selected.rows.length,
      errores: syncErrors,
      limite: limit,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido al sincronizar Mercado Libre.";
    await query("UPDATE public.mercadolibre_sincronizacion SET estado = 'ERROR', errores = $2::jsonb, error_count = 1, finished_at = NOW() WHERE id = $1", [runId, JSON.stringify([message])]);
    await query("UPDATE public.mercadolibre_cuenta SET ultimo_estado_sincronizacion = 'ERROR', ultimo_error_sincronizacion = $2, updated_at = NOW() WHERE id = $1", [idCuenta, message]);
    throw error;
  }
}

type MeliOrder = {
  id?: number | string;
  date_created?: string;
  status?: string;
  total_amount?: number;
  currency_id?: string;
  buyer?: { nickname?: string | null };
  shipping?: { id?: number | string; logistic_type?: string | null; shipping_option?: { name?: string | null }; pickup_id?: string | null };
  order_items?: Array<{ item?: { id?: string; title?: string; seller_sku?: string | null }; quantity?: number }>;
};

type MeliQuestion = {
  id?: number | string;
  item_id?: string;
  text?: string;
  status?: string;
  date_created?: string;
  from?: { id?: number | string | null; nickname?: string | null };
  answer?: { text?: string | null; date_created?: string | null } | null;
};

type MeliWebhookEventRow = {
  id: number;
  id_cuenta: number;
  topic: string;
  recurso: string;
};

async function getPagedMeliResults<T>(path: string, idCuenta: number, accessToken: string, maxResults = 1000, pageSize = 100) {
  const result: T[] = [];
  for (let offset = 0; offset < maxResults; offset += pageSize) {
    const separator = path.includes("?") ? "&" : "?";
    const payload = await meliGet(`${path}${separator}limit=${pageSize}&offset=${offset}`, idCuenta, accessToken) as { results?: T[]; questions?: T[]; paging?: { total?: number } };
    const page = Array.isArray(payload.results) ? payload.results : Array.isArray(payload.questions) ? payload.questions : [];
    result.push(...page);
    const total = Number(payload.paging?.total);
    if (page.length < pageSize || (Number.isFinite(total) && total > 0 && result.length >= total)) break;
  }
  return result.slice(0, maxResults);
}

async function sincronizarVentasMercadoLibre(idCuenta: number, sellerId: number, accessToken: string) {
  const ventas = await getPagedMeliResults<MeliOrder>(`/orders/search?seller=${sellerId}&order.status=paid&sort=date_desc`, idCuenta, accessToken, 1000, 50);
  for (const venta of ventas) {
    if (!venta.id) continue;
    const items = (venta.order_items || []).map((linea) => ({
      itemId: linea.item?.id ? String(linea.item.id) : null,
      titulo: linea.item?.title || "Sin titulo",
      cantidad: Number(linea.quantity || 0),
      sku: linea.item?.seller_sku || null,
    }));
    const shipping = venta.shipping;
    const envio = shipping?.shipping_option?.name || shipping?.logistic_type || (shipping?.id ? "Con envio" : null);
    await query(
      `INSERT INTO public.mercadolibre_venta (
        id_cuenta, venta_id, fecha, estado, comprador, total, moneda, envio, retiro_en_persona, items, datos, sincronizada_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, NOW(), NOW())
      ON CONFLICT (id_cuenta, venta_id) DO UPDATE SET
        fecha = EXCLUDED.fecha, estado = EXCLUDED.estado, comprador = EXCLUDED.comprador, total = EXCLUDED.total,
        moneda = EXCLUDED.moneda, envio = EXCLUDED.envio, retiro_en_persona = EXCLUDED.retiro_en_persona,
        items = EXCLUDED.items, datos = EXCLUDED.datos, sincronizada_at = NOW(), updated_at = NOW()`,
      [idCuenta, String(venta.id), venta.date_created || null, venta.status || "unknown", venta.buyer?.nickname || null,
        Number.isFinite(Number(venta.total_amount)) ? Number(venta.total_amount) : null, venta.currency_id || null,
        envio, Boolean(shipping?.pickup_id), JSON.stringify(items), JSON.stringify(venta)],
    );
  }
  return ventas.length;
}

async function guardarVentaMercadoLibre(idCuenta: number, venta: MeliOrder) {
  if (!venta.id) return;
  const items = (venta.order_items || []).map((linea) => ({
    itemId: linea.item?.id ? String(linea.item.id) : null,
    titulo: linea.item?.title || "Sin titulo",
    cantidad: Number(linea.quantity || 0),
    sku: linea.item?.seller_sku || null,
  }));
  const shipping = venta.shipping;
  const envio = shipping?.shipping_option?.name || shipping?.logistic_type || (shipping?.id ? "Con envio" : null);
  await query(
    `INSERT INTO public.mercadolibre_venta (
      id_cuenta, venta_id, fecha, estado, comprador, total, moneda, envio, retiro_en_persona, items, datos, sincronizada_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, NOW(), NOW())
    ON CONFLICT (id_cuenta, venta_id) DO UPDATE SET
      fecha = EXCLUDED.fecha, estado = EXCLUDED.estado, comprador = EXCLUDED.comprador, total = EXCLUDED.total,
      moneda = EXCLUDED.moneda, envio = EXCLUDED.envio, retiro_en_persona = EXCLUDED.retiro_en_persona,
      items = EXCLUDED.items, datos = EXCLUDED.datos, sincronizada_at = NOW(), updated_at = NOW()`,
    [idCuenta, String(venta.id), venta.date_created || null, venta.status || "unknown", venta.buyer?.nickname || null,
      Number.isFinite(Number(venta.total_amount)) ? Number(venta.total_amount) : null, venta.currency_id || null,
      envio, Boolean(shipping?.pickup_id), JSON.stringify(items), JSON.stringify(venta)],
  );
}

async function guardarPreguntaMercadoLibre(idCuenta: number, pregunta: MeliQuestion, options: { notificar?: boolean } = {}) {
  if (!pregunta.id || !pregunta.text) return;
  const { rows } = await query<{ creada: boolean; titulo: string | null; estado: string }>(
    `INSERT INTO public.mercadolibre_pregunta (
      id_cuenta, pregunta_id, item_id, titulo, comprador, comprador_id, texto, estado, fecha, respuesta, respondida_at, datos, sincronizada_at, updated_at
    ) VALUES (
      $1, $2, $3,
      (SELECT titulo FROM public.mercadolibre_publicacion WHERE id_cuenta = $1 AND item_id = $3 LIMIT 1),
      $4, $5, $6, $7, $8, $9, $10, $11::jsonb, NOW(), NOW()
    ) ON CONFLICT (id_cuenta, pregunta_id) DO UPDATE SET
      item_id = EXCLUDED.item_id, titulo = COALESCE(EXCLUDED.titulo, mercadolibre_pregunta.titulo), comprador = EXCLUDED.comprador, comprador_id = EXCLUDED.comprador_id,
      texto = EXCLUDED.texto, estado = EXCLUDED.estado, fecha = EXCLUDED.fecha, respuesta = EXCLUDED.respuesta,
      respondida_at = EXCLUDED.respondida_at, datos = EXCLUDED.datos, sincronizada_at = NOW(), updated_at = NOW()
    RETURNING (xmax = 0) AS creada, titulo, estado`,
    [idCuenta, String(pregunta.id), pregunta.item_id || null, pregunta.from?.nickname || null,
      pregunta.from?.id === null || pregunta.from?.id === undefined ? null : String(pregunta.from.id), pregunta.text,
      pregunta.status || "UNANSWERED", pregunta.date_created || null, pregunta.answer?.text || null,
      pregunta.answer?.date_created || null, JSON.stringify(pregunta)],
  );
  const saved = rows[0];
  if (options.notificar && saved?.creada && saved.estado === "UNANSWERED") {
    try {
      const { rows: publicationRows } = await query<{ titulo: string | null; thumbnail_url: string | null }>(
        "SELECT titulo, thumbnail_url FROM public.mercadolibre_publicacion WHERE id_cuenta = $1 AND item_id = $2 LIMIT 1",
        [idCuenta, pregunta.item_id || null],
      );
      const publication = publicationRows[0];
      await notificarNuevaPreguntaMercadoLibre({
        idCuenta,
        preguntaId: String(pregunta.id),
        titulo: saved.titulo || publication?.titulo || null,
        thumbnailUrl: secureThumbnailUrl(publication?.thumbnail_url),
        texto: pregunta.text,
      });
    } catch (error) {
      console.error("La pregunta se guardo, pero no se pudo enviar la notificacion push.", error);
    }
  }
}

async function sincronizarPreguntasMercadoLibre(idCuenta: number, sellerId: number, accessToken: string) {
  const basePath = `/questions/search?seller_id=${sellerId}&sort_fields=date_created&sort_types=DESC&api_version=4`;
  const [pendientes, historial] = await Promise.all([
    getPagedMeliResults<MeliQuestion>(`${basePath}&status=UNANSWERED`, idCuenta, accessToken),
    getPagedMeliResults<MeliQuestion>(basePath, idCuenta, accessToken),
  ]);
  const preguntas = Array.from(new Map(
    [...pendientes, ...historial]
      .filter((pregunta) => pregunta.id)
      .map((pregunta) => [String(pregunta.id), pregunta]),
  ).values());
  for (const pregunta of preguntas) {
    if (!pregunta.id || !pregunta.text) continue;
    await query(
      `INSERT INTO public.mercadolibre_pregunta (
        id_cuenta, pregunta_id, item_id, titulo, comprador, comprador_id, texto, estado, fecha, respuesta, respondida_at, datos, sincronizada_at, updated_at
      ) VALUES (
        $1, $2, $3,
        (SELECT titulo FROM public.mercadolibre_publicacion WHERE id_cuenta = $1 AND item_id = $3 LIMIT 1),
        $4, $5, $6, $7, $8, $9, $10, $11::jsonb, NOW(), NOW()
      ) ON CONFLICT (id_cuenta, pregunta_id) DO UPDATE SET
        item_id = EXCLUDED.item_id, titulo = COALESCE(EXCLUDED.titulo, mercadolibre_pregunta.titulo), comprador = EXCLUDED.comprador, comprador_id = EXCLUDED.comprador_id,
        texto = EXCLUDED.texto, estado = EXCLUDED.estado, fecha = EXCLUDED.fecha, respuesta = EXCLUDED.respuesta,
        respondida_at = EXCLUDED.respondida_at, datos = EXCLUDED.datos, sincronizada_at = NOW(), updated_at = NOW()`,
      [idCuenta, String(pregunta.id), pregunta.item_id || null, pregunta.from?.nickname || null,
        pregunta.from?.id === null || pregunta.from?.id === undefined ? null : String(pregunta.from.id), pregunta.text,
        pregunta.status || "UNANSWERED", pregunta.date_created || null, pregunta.answer?.text || null,
        pregunta.answer?.date_created || null, JSON.stringify(pregunta)],
    );
  }
  return preguntas.length;
}

async function registrarSincronizacionParcialMercadoLibre(idCuenta: number, error?: unknown) {
  const mensaje = error instanceof Error ? error.message.slice(0, 1_000) : null;
  await query(
    `UPDATE public.mercadolibre_cuenta
     SET ultima_sincronizacion_at = NOW(),
         ultimo_estado_sincronizacion = $2,
         ultimo_error_sincronizacion = $3,
         updated_at = NOW()
     WHERE id = $1`,
    [idCuenta, mensaje ? "ERROR" : "OK", mensaje],
  );
}

export async function sincronizarPreguntasMercadoLibreAhora(idCuenta: number) {
  try {
    const { accessToken, sellerId } = await accessTokenForCuenta(idCuenta);
    const actualizadas = await sincronizarPreguntasMercadoLibre(idCuenta, sellerId, accessToken);
    await registrarSincronizacionParcialMercadoLibre(idCuenta);
    return actualizadas;
  } catch (error) {
    await registrarSincronizacionParcialMercadoLibre(idCuenta, error);
    throw error;
  }
}

export async function sincronizarVentasMercadoLibreAhora(idCuenta: number) {
  try {
    const { accessToken, sellerId } = await accessTokenForCuenta(idCuenta);
    const actualizadas = await sincronizarVentasMercadoLibre(idCuenta, sellerId, accessToken);
    await registrarSincronizacionParcialMercadoLibre(idCuenta);
    return actualizadas;
  } catch (error) {
    await registrarSincronizacionParcialMercadoLibre(idCuenta, error);
    throw error;
  }
}

export async function responderPreguntaMercadoLibre(idCuenta: number, preguntaId: string, texto: string) {
  const answer = texto.trim();
  if (!answer) throw new AppError("Escribe una respuesta antes de enviarla.", 400);
  if (answer.length > 2_000) throw new AppError("La respuesta admite hasta 2.000 caracteres.", 400);
  const existing = await query<{ id: number }>(
    "SELECT id FROM public.mercadolibre_pregunta WHERE id_cuenta = $1 AND pregunta_id = $2 AND estado = 'UNANSWERED' LIMIT 1",
    [idCuenta, preguntaId],
  );
  if (!existing.rows[0]) throw new AppError("La pregunta ya fue respondida o no pertenece a esta cuenta.", 409);
  const { accessToken } = await accessTokenForCuenta(idCuenta);
  const response = await meliPost("/answers", idCuenta, accessToken, { question_id: Number(preguntaId), text: answer }) as MeliQuestion;
  await query(
    `UPDATE public.mercadolibre_pregunta
     SET estado = 'ANSWERED', respuesta = $3, respondida_at = NOW(),
         datos = COALESCE(datos, '{}'::jsonb) || $4::jsonb,
         sincronizada_at = NOW(), updated_at = NOW()
     WHERE id_cuenta = $1 AND pregunta_id = $2`,
    [idCuenta, preguntaId, answer, JSON.stringify(response)],
  );
}

async function guardarPublicacionDesdeWebhook(idCuenta: number, item: MeliItem) {
  if (!item.id) return;
  const publication = mapPublicacion(item);
  const code = normalizeMatchingCode(publication.sellerSku);
  const [products, kits] = await Promise.all([
    productIdsByCode(code ? [code] : []),
    kitIdsByCode(code ? [code] : []),
  ]);
  const candidateProductId = code ? products.get(code) || null : null;
  const candidateKitId = code ? kits.get(code) || null : null;
  const productId = candidateProductId && !candidateKitId ? candidateProductId : null;
  const kitId = candidateKitId && !candidateProductId ? candidateKitId : null;
  await query(
    `INSERT INTO public.mercadolibre_publicacion (
      id_cuenta, item_id, id_producto, id_kit, tipo_vinculo, seller_sku, titulo, estado, categoria_id, tipo_publicacion,
      precio, precio_original, moneda, cantidad_disponible, cantidad_vendida, thumbnail_url, permalink, variaciones, datos,
      ultima_vez_vista_at, sincronizada_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18::jsonb, $19::jsonb, NOW(), NOW(), NOW())
    ON CONFLICT (id_cuenta, item_id) DO UPDATE SET
      id_producto = CASE WHEN mercadolibre_publicacion.tipo_vinculo IN ('MANUAL', 'EXCLUIDO_MANUAL') THEN mercadolibre_publicacion.id_producto ELSE EXCLUDED.id_producto END,
      id_kit = CASE WHEN mercadolibre_publicacion.tipo_vinculo IN ('MANUAL', 'EXCLUIDO_MANUAL') THEN mercadolibre_publicacion.id_kit ELSE EXCLUDED.id_kit END,
      tipo_vinculo = CASE WHEN mercadolibre_publicacion.tipo_vinculo IN ('MANUAL', 'EXCLUIDO_MANUAL') THEN mercadolibre_publicacion.tipo_vinculo ELSE EXCLUDED.tipo_vinculo END,
      seller_sku = EXCLUDED.seller_sku, titulo = EXCLUDED.titulo, estado = EXCLUDED.estado, categoria_id = EXCLUDED.categoria_id,
      tipo_publicacion = EXCLUDED.tipo_publicacion, precio = EXCLUDED.precio, precio_original = EXCLUDED.precio_original,
      moneda = EXCLUDED.moneda, cantidad_disponible = EXCLUDED.cantidad_disponible, cantidad_vendida = EXCLUDED.cantidad_vendida,
      thumbnail_url = EXCLUDED.thumbnail_url, permalink = EXCLUDED.permalink, variaciones = EXCLUDED.variaciones,
      datos = EXCLUDED.datos, ultima_vez_vista_at = NOW(), sincronizada_at = NOW(), updated_at = NOW()`,
    [idCuenta, publication.itemId, productId, kitId, productId || kitId ? "CODIGO_EXACTO" : "SIN_VINCULO", publication.sellerSku,
      publication.titulo, publication.estado, publication.categoriaId, publication.tipoPublicacion, publication.precio,
      publication.precioOriginal, publication.moneda, publication.cantidadDisponible, publication.cantidadVendida,
      publication.thumbnailUrl, publication.permalink, JSON.stringify(publication.variaciones), JSON.stringify(publication)],
  );
}

function recursoPermitido(topic: string, recurso: string) {
  if (topic === "orders_v2") return /^\/orders\/\d+$/.test(recurso);
  if (topic === "questions") return /^\/questions\/\d+$/.test(recurso);
  if (topic === "items") return /^\/items\/ML[A-Z]+\d+$/i.test(recurso);
  return false;
}

async function procesarEventoMercadoLibreReclamado(row: MeliWebhookEventRow) {
  const { accessToken } = await accessTokenForCuenta(row.id_cuenta);
  if (!recursoPermitido(row.topic, row.recurso)) {
    await query(
      "UPDATE public.mercadolibre_webhook_evento SET estado = 'IGNORADO', procesado_at = NOW(), ultimo_error = NULL WHERE id = $1",
      [row.id],
    );
    return;
  }
  const resource = await meliGet(row.recurso, row.id_cuenta, accessToken);
  if (row.topic === "orders_v2") await guardarVentaMercadoLibre(row.id_cuenta, resource as MeliOrder);
  if (row.topic === "questions") await guardarPreguntaMercadoLibre(row.id_cuenta, resource as MeliQuestion, { notificar: true });
  if (row.topic === "items") await guardarPublicacionDesdeWebhook(row.id_cuenta, resource as MeliItem);
  await query(
    "UPDATE public.mercadolibre_webhook_evento SET estado = 'PROCESADO', procesado_at = NOW(), ultimo_error = NULL WHERE id = $1",
    [row.id],
  );
}

export async function procesarEventoMercadoLibre(idEvento: number) {
  const claimed = await query<MeliWebhookEventRow>(
    `UPDATE public.mercadolibre_webhook_evento
     SET estado = 'PROCESANDO', intentos = intentos + 1
     WHERE id = $1 AND estado = 'PENDIENTE' AND proximo_intento_at <= NOW()
     RETURNING id, id_cuenta, topic, recurso`,
    [idEvento],
  );
  const row = claimed.rows[0];
  if (!row) return false;
  try {
    await procesarEventoMercadoLibreReclamado(row);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido al procesar el evento.";
    await query(
      `UPDATE public.mercadolibre_webhook_evento
       SET estado = CASE WHEN intentos >= 5 THEN 'ERROR' ELSE 'PENDIENTE' END,
           proximo_intento_at = NOW() + (LEAST(intentos, 5) * INTERVAL '5 minutes'),
           ultimo_error = $2
       WHERE id = $1`,
      [row.id, message.slice(0, 1_000)],
    );
    throw error;
  }
}

export async function procesarEventosMercadoLibrePendientes(limit = 25) {
  const claimed = await query<MeliWebhookEventRow>(
    `WITH pendientes AS (
       SELECT id FROM public.mercadolibre_webhook_evento
       WHERE estado = 'PENDIENTE' AND proximo_intento_at <= NOW()
       ORDER BY recibido_at ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     UPDATE public.mercadolibre_webhook_evento evento
     SET estado = 'PROCESANDO', intentos = evento.intentos + 1
     FROM pendientes
     WHERE evento.id = pendientes.id
     RETURNING evento.id, evento.id_cuenta, evento.topic, evento.recurso`,
    [Math.max(1, Math.min(limit, 100))],
  );
  let procesados = 0;
  let errores = 0;
  for (const row of claimed.rows) {
    try {
      await procesarEventoMercadoLibreReclamado(row);
      procesados += 1;
    } catch (error) {
      errores += 1;
      const message = error instanceof Error ? error.message : "Error desconocido al procesar el evento.";
      await query(
        `UPDATE public.mercadolibre_webhook_evento
         SET estado = CASE WHEN intentos >= 5 THEN 'ERROR' ELSE 'PENDIENTE' END,
             proximo_intento_at = NOW() + (LEAST(intentos, 5) * INTERVAL '5 minutes'),
             ultimo_error = $2
         WHERE id = $1`,
        [row.id, message.slice(0, 1_000)],
      );
    }
  }
  return { reclamados: claimed.rows.length, procesados, errores };
}

async function productIdsByCode(codes: string[]) {
  if (!codes.length) return new Map<string, number>();
  const normalizedCodes = Array.from(new Set(codes.map(normalizeMatchingCode).filter(Boolean)));
  if (!normalizedCodes.length) return new Map<string, number>();
  const { rows } = await query<{ codigo: string; id: number }>(
    `SELECT regexp_replace(upper(trim(cod_unico)), '[^A-Z0-9]+', '', 'g') AS codigo, MIN(id)::int AS id
     FROM public.productos
     WHERE regexp_replace(upper(trim(cod_unico)), '[^A-Z0-9]+', '', 'g') = ANY($1::text[])
       AND COALESCE(oculto_por_kit, FALSE) = FALSE
     GROUP BY regexp_replace(upper(trim(cod_unico)), '[^A-Z0-9]+', '', 'g')
     HAVING COUNT(*) = 1`,
    [normalizedCodes]
  );
  return new Map(rows.map((row) => [String(row.codigo), Number(row.id)]));
}

async function kitIdsByCode(codes: string[]) {
  if (!codes.length) return new Map<string, number>();
  const normalizedCodes = Array.from(new Set(codes.map(normalizeMatchingCode).filter(Boolean)));
  if (!normalizedCodes.length) return new Map<string, number>();
  const { rows } = await query<{ codigo: string; id: number }>(
    `SELECT regexp_replace(upper(trim(codigo_kit)), '[^A-Z0-9]+', '', 'g') AS codigo, MIN(id)::int AS id
     FROM public.kits
     WHERE regexp_replace(upper(trim(codigo_kit)), '[^A-Z0-9]+', '', 'g') = ANY($1::text[])
       AND COALESCE(activo, TRUE) = TRUE
     GROUP BY regexp_replace(upper(trim(codigo_kit)), '[^A-Z0-9]+', '', 'g')
     HAVING COUNT(*) = 1`,
    [normalizedCodes]
  );
  return new Map(rows.map((row) => [String(row.codigo), Number(row.id)]));
}

export async function sincronizarMercadoLibre(idCuenta: number): Promise<MercadoLibreSyncResult> {
  const { accessToken, sellerId } = await accessTokenForCuenta(idCuenta);
  await query(
    `UPDATE public.mercadolibre_cuenta
     SET ultimo_estado_sincronizacion = 'EN_PROCESO', ultimo_error_sincronizacion = NULL, updated_at = NOW()
     WHERE id = $1`,
    [idCuenta]
  );
  const run = await query<{ id: number }>("INSERT INTO public.mercadolibre_sincronizacion (id_cuenta) VALUES ($1) RETURNING id", [idCuenta]);
  const runId = Number(run.rows[0].id);

  try {
    const ids = await getAllItemIds(idCuenta, sellerId, accessToken);
    const { items, errors } = await getItemDetails(ids, idCuenta, accessToken);
    const publicaciones = await guardarPublicacionesMercadoLibre(idCuenta, items);

    let ventas = 0;
    let preguntas = 0;
    try {
      ventas = await sincronizarVentasMercadoLibre(idCuenta, sellerId, accessToken);
    } catch (error) {
      if (errors.length < 50) errors.push(`No se pudieron leer las ventas: ${error instanceof Error ? error.message : "error desconocido"}`);
    }
    try {
      preguntas = await sincronizarPreguntasMercadoLibre(idCuenta, sellerId, accessToken);
    } catch (error) {
      if (errors.length < 50) errors.push(`No se pudieron leer las preguntas: ${error instanceof Error ? error.message : "error desconocido"}`);
    }
    const result = { ...publicaciones, errores: errors, ventas, preguntas };
    await query(
      `UPDATE public.mercadolibre_sincronizacion
       SET estado = 'OK', total_publicaciones = $2, vinculadas_por_codigo = $3, sin_vinculo = $4, errores = $5::jsonb,
           error_count = $6, finished_at = NOW() WHERE id = $1`,
      [runId, result.total, result.vinculadasPorCodigo, result.sinVinculo, JSON.stringify(errors), errors.length]
    );
    await query(
      `UPDATE public.mercadolibre_cuenta
       SET ultima_sincronizacion_at = NOW(), ultimo_estado_sincronizacion = 'OK', ultimo_error_sincronizacion = NULL, updated_at = NOW()
       WHERE id = $1`, [idCuenta]
    );
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido al sincronizar Mercado Libre.";
    await query("UPDATE public.mercadolibre_sincronizacion SET estado = 'ERROR', errores = $2::jsonb, error_count = 1, finished_at = NOW() WHERE id = $1", [runId, JSON.stringify([message])]);
    await query("UPDATE public.mercadolibre_cuenta SET ultimo_estado_sincronizacion = 'ERROR', ultimo_error_sincronizacion = $2, updated_at = NOW() WHERE id = $1", [idCuenta, message]);
    throw error;
  }
}
