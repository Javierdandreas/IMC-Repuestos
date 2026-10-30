import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

import { AppError } from "@/lib/api-errors";
import { query, withTransaction } from "@/lib/db-utils";
import { notificarNuevaPreguntaMercadoLibre, notificarNuevoMensajePostVentaMercadoLibre } from "@/lib/notificaciones-push";
import { atributosObligatoriosFaltantes, interpretarValidacionPublicacion, prepararValidacionPublicacion, protegerDiagnostico, type AtributoCategoriaPublicacion } from "@/lib/mercadolibre-validacion-publicacion";
import { atributosParaDescripcion } from "@/lib/mercadolibre-descripcion";
import { dominiosCompatibles, planCopiaCompatibilidades, solicitudCopiaUserProduct, totalCompatibilidades, totalResumen } from "@/lib/mercadolibre-copia-compatibilidades";
import { opcionMensajePersonalizado, ventaAptaParaMensaje } from "@/lib/mercadolibre-mensajes-prueba";
import {
  ATRIBUTOS_VEHICULO_ML,
  DOMINIO_VEHICULOS_ML,
  esAtributoVehiculo,
  firmaCompatibilidadVehiculo,
  guardarEstadoAtributosVehiculo,
  guardarVehiculosCanonicos,
  guardarValoresCatalogoVehiculos,
  normalizarAtributosVehiculo,
  obtenerValoresCatalogoVehiculos,
  type AtributoVehiculoId,
  type ValorVehiculo,
} from "@/lib/catalogo-vehiculos-mercadolibre";
import type {
  MercadoLibreCuentaEstado,
  MercadoLibreCostoEstimado,
  MercadoLibreCostoSincronizacion,
  MercadoLibrePublicacion,
  MercadoLibrePublicacionesResult,
  MercadoLibrePreguntaListado,
  MercadoLibrePreguntasResult,
  MercadoLibreVentaConversacion,
  MercadoLibreSyncResult,
  MercadoLibreVentaListado,
  MercadoLibreVentasResult,
} from "@/interfaces/mercadolibre";

const API_BASE_URL = "https://api.mercadolibre.com";
const AUTH_BASE_URL = "https://auth.mercadolibre.com.ar/authorization";
const REFRESH_MARGIN_MS = 60_000;
const ITEM_BATCH_SIZE = 20;
const MAX_SYNC_ITEMS = 25_000;
const CATEGORY_ATTRIBUTES_CACHE_MS = 10 * 60_000;
const categoryAttributesCache = new Map<string, { expiresAt: number; values: AtributoCategoriaPublicacion[] }>();

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
  if (!value) throw new AppError(`Falta configurar ${name} en las variables de entorno.`, 503);
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

function etiquetaTipoEnvio(shipping: Record<string, unknown>) {
  const option = shipping.shipping_option && typeof shipping.shipping_option === "object" && !Array.isArray(shipping.shipping_option)
    ? shipping.shipping_option as Record<string, unknown>
    : {};
  const values = [shipping.logistic_type, shipping.mode, option.name].filter((value): value is string => typeof value === "string").join(" ").toLowerCase();
  if (values.includes("flex")) return "FLEX";
  if (values.includes("self_service")) return "FLEX";
  if (values.includes("cross_docking") || values.includes("collect") || values.includes("recolec")) return "COLECTA";
  if (values.includes("fulfillment")) return "FULL";
  if (values.includes("drop_off")) return "DROP OFF";
  return typeof shipping.logistic_type === "string" ? shipping.logistic_type.replaceAll("_", " ").toUpperCase() : null;
}

function nombreComprador(buyer: Record<string, unknown>, fallback: string | null) {
  const fullName = [buyer.first_name, buyer.last_name]
    .filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
    .join(" ")
    .trim();
  return fullName || fallback;
}

async function mensajesNoLeidosPorPack(idCuenta: number) {
  try {
    const { accessToken } = await accessTokenForCuenta(idCuenta);
    const payload = await meliGet("/messages/unread?role=seller&tag=post_sale", idCuenta, accessToken) as Record<string, unknown>;
    const results = Array.isArray(payload.results) ? payload.results : [];
    return new Map(results.flatMap((result) => {
      const value = result && typeof result === "object" ? result as Record<string, unknown> : {};
      const resource = typeof value.resource === "string" ? value.resource : "";
      const packId = /^\/packs\/(\d+)\/sellers\/\d+/.exec(resource)?.[1];
      const count = Number(value.count);
      return packId && Number.isFinite(count) && count > 0 ? [[packId, count] as const] : [];
    }));
  } catch (error) {
    console.warn("[MERCADOLIBRE] No se pudieron consultar los mensajes no leidos:", error instanceof Error ? error.message : error);
    return new Map<string, number>();
  }
}

export type FiltroEnvioVentaMercadoLibre = "TODOS" | "FLEX" | "COLECTA" | "FULL" | "DROP_OFF" | "OTRO";
export type FiltroMensajeVentaMercadoLibre = "TODOS" | "NO_LEIDOS" | "LEIDOS" | "RESPONDIDOS" | "SIN_RESPONDER";

async function seguimientoMensajesPostventaDisponible() {
  const result = await query<{ total: number }>(`
    SELECT COUNT(*)::int AS total
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'mercadolibre_mensaje_postventa_notificado'
      AND column_name IN ('leido_at', 'respondido_at')
  `);
  return Number(result.rows[0]?.total || 0) === 2;
}

function tipoEnvioVenta(shipping: Record<string, unknown>): MercadoLibreVentaListado["tipoEnvio"] {
  const tipo = etiquetaTipoEnvio(shipping);
  if (tipo === "FLEX" || tipo === "COLECTA" || tipo === "FULL" || tipo === "DROP OFF") return tipo;
  return tipo ? "OTRO" : null;
}

export async function getMercadoLibreVentas(
  idCuenta: number,
  page = 1,
  limit = 50,
  filters: { envio?: FiltroEnvioVentaMercadoLibre; mensajes?: FiltroMensajeVentaMercadoLibre } = {},
): Promise<MercadoLibreVentasResult> {
  const envio = (["TODOS", "FLEX", "COLECTA", "FULL", "DROP_OFF", "OTRO"] as const).includes(filters.envio as FiltroEnvioVentaMercadoLibre)
    ? filters.envio as FiltroEnvioVentaMercadoLibre
    : "TODOS";
  const mensajes = (["TODOS", "NO_LEIDOS", "LEIDOS", "RESPONDIDOS", "SIN_RESPONDER"] as const).includes(filters.mensajes as FiltroMensajeVentaMercadoLibre)
    ? filters.mensajes as FiltroMensajeVentaMercadoLibre
    : "TODOS";
  const unreadByPack = await mensajesNoLeidosPorPack(idCuenta);
  const unreadPacks = [...unreadByPack.keys()];
  const hasSeguimiento = mensajes === "RESPONDIDOS" || mensajes === "SIN_RESPONDER" ? await seguimientoMensajesPostventaDisponible() : false;
  const params: unknown[] = [idCuenta];
  const where = ["venta.id_cuenta = $1"];
  const packId = "COALESCE(NULLIF(venta.datos->>'pack_id', ''), venta.venta_id)";
  const logistics = "LOWER(CONCAT_WS(' ', venta.datos #>> '{shipping,logistic_type}', venta.datos #>> '{shipping,mode}', venta.datos #>> '{shipping,shipping_option,name}'))";
  const hasNotifiedMessage = "EXISTS (SELECT 1 FROM public.mercadolibre_mensaje_postventa_notificado notificado WHERE notificado.id_cuenta = venta.id_cuenta AND notificado.venta_id = venta.venta_id)";

  if (envio === "FLEX") where.push(`(${logistics} LIKE '%flex%' OR ${logistics} LIKE '%self_service%')`);
  if (envio === "COLECTA") where.push(`(${logistics} LIKE '%cross_docking%' OR ${logistics} LIKE '%collect%' OR ${logistics} LIKE '%recolec%')`);
  if (envio === "FULL") where.push(`${logistics} LIKE '%fulfillment%'`);
  if (envio === "DROP_OFF") where.push(`${logistics} LIKE '%drop_off%'`);
  if (envio === "OTRO") where.push(`NOT (${logistics} LIKE '%flex%' OR ${logistics} LIKE '%self_service%' OR ${logistics} LIKE '%cross_docking%' OR ${logistics} LIKE '%collect%' OR ${logistics} LIKE '%recolec%' OR ${logistics} LIKE '%fulfillment%' OR ${logistics} LIKE '%drop_off%')`);

  if (mensajes === "NO_LEIDOS") {
    if (!unreadPacks.length) where.push("FALSE");
    else { params.push(unreadPacks); where.push(`${packId} = ANY($${params.length}::text[])`); }
  }
  if (mensajes === "LEIDOS") {
    where.push(hasNotifiedMessage);
    if (unreadPacks.length) { params.push(unreadPacks); where.push(`${packId} <> ALL($${params.length}::text[])`); }
  }
  if (mensajes === "RESPONDIDOS") where.push(hasSeguimiento
    ? "EXISTS (SELECT 1 FROM public.mercadolibre_mensaje_postventa_notificado notificado WHERE notificado.id_cuenta = venta.id_cuenta AND notificado.venta_id = venta.venta_id AND notificado.respondido_at IS NOT NULL)"
    : "FALSE");
  if (mensajes === "SIN_RESPONDER") where.push(hasSeguimiento
    ? "EXISTS (SELECT 1 FROM public.mercadolibre_mensaje_postventa_notificado notificado WHERE notificado.id_cuenta = venta.id_cuenta AND notificado.venta_id = venta.venta_id AND notificado.respondido_at IS NULL)"
    : hasNotifiedMessage);

  const totalResult = await query<{ total_count: number }>(`SELECT COUNT(*)::int AS total_count FROM public.mercadolibre_venta venta WHERE ${where.join(" AND ")}`, params);
  const totalCount = Number(totalResult.rows[0]?.total_count || 0);
  if (!totalCount) return { data: [], totalCount: 0, totalPages: 0 };
  const safePage = Math.max(1, page);
  const { rows } = await query<Record<string, unknown>>(
    `SELECT venta.id, venta.venta_id, venta.fecha, venta.estado, venta.comprador, venta.total, venta.moneda, venta.envio, venta.retiro_en_persona, venta.datos,
            NULLIF(venta.datos #>> '{shipping,id}', '') AS numero_envio,
            ${packId} AS pack_id, venta.items, venta.sincronizada_at,
            COALESCE(mensaje.estado, evento.estado) AS mensaje_estado,
            COALESCE(mensaje.detalle, evento.detalle) AS mensaje_detalle
     FROM public.mercadolibre_venta venta
     LEFT JOIN public.mercadolibre_mensaje_prueba mensaje ON mensaje.id_cuenta = venta.id_cuenta AND mensaje.pack_id = ${packId}
     LEFT JOIN public.mercadolibre_mensaje_automatico_evento evento ON evento.id_cuenta = venta.id_cuenta AND evento.venta_id = venta.venta_id
     WHERE ${where.join(" AND ")}
     ORDER BY venta.fecha DESC NULLS LAST, venta.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, (safePage - 1) * limit],
  );
  const itemIds = [...new Set(rows.flatMap((row) => Array.isArray(row.items) ? row.items.map((item) => item && typeof item === "object" ? String((item as Record<string, unknown>).itemId || "") : "") : []).filter(Boolean))];
  const publicationRows = itemIds.length ? await query<{ item_id: string; thumbnail_url: string | null }>(
    "SELECT item_id, thumbnail_url FROM public.mercadolibre_publicacion WHERE id_cuenta = $1 AND item_id = ANY($2::text[])",
    [idCuenta, itemIds],
  ) : { rows: [] as Array<{ item_id: string; thumbnail_url: string | null }> };
  const thumbnailByItem = new Map(publicationRows.rows.map((publication) => [publication.item_id, secureThumbnailUrl(publication.thumbnail_url)]));
  return {
    data: rows.map((row): MercadoLibreVentaListado => {
      const datos = row.datos && typeof row.datos === "object" && !Array.isArray(row.datos) ? row.datos as Record<string, unknown> : {};
      const shipping = datos.shipping && typeof datos.shipping === "object" && !Array.isArray(datos.shipping) ? datos.shipping as Record<string, unknown> : {};
      return {
        id: Number(row.id), ventaId: String(row.venta_id), fecha: row.fecha ? new Date(String(row.fecha)).toISOString() : null,
        estado: String(row.estado), comprador: row.comprador ? String(row.comprador) : null,
        total: row.total === null ? null : Number(row.total), moneda: row.moneda ? String(row.moneda) : null,
        envio: row.envio ? String(row.envio) : null, tipoEnvio: tipoEnvioVenta(shipping), retiroEnPersona: Boolean(row.retiro_en_persona),
        mensajeEstado: row.mensaje_estado ? String(row.mensaje_estado) : null,
        mensajeDetalle: row.mensaje_detalle ? String(row.mensaje_detalle) : null,
        mensajesNoLeidos: unreadByPack.get(String(row.pack_id || row.venta_id)) || 0,
        numeroEnvio: row.numero_envio ? String(row.numero_envio) : null,
        items: Array.isArray(row.items) ? row.items.map((item: Record<string, unknown>) => {
          const itemId = item.itemId ? String(item.itemId) : null;
          return { itemId, titulo: String(item.titulo || "Sin titulo"), cantidad: Number(item.cantidad || 0), sku: item.sku ? String(item.sku) : null, thumbnailUrl: itemId ? thumbnailByItem.get(itemId) || null : null };
        }) : [],
        sincronizadaAt: new Date(String(row.sincronizada_at)).toISOString(),
      };
    }),
    totalCount,
    totalPages: Math.ceil(totalCount / limit),
  };
}

function textoMensajePostVenta(value: unknown) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const plain = (value as Record<string, unknown>).plain;
  return typeof plain === "string" ? plain : "";
}

function idSeguro(value: unknown) {
  const normalized = String(value || "").trim();
  return /^\d+$/.test(normalized) ? normalized : null;
}

function idAdjuntoSeguro(value: unknown) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,299}$/.test(normalized) ? normalized : null;
}

function tipoSeguroAdjunto(value: string | null) {
  const normalized = String(value || "").split(";", 1)[0].trim().toLowerCase();
  return /^(application\/pdf|image\/(avif|gif|jpe?g|png|webp)|text\/plain)$/.test(normalized)
    ? normalized
    : "application/octet-stream";
}

async function actualizarSeguimientoMensajesPostventa(idCuenta: number, ventaId: string, respondido = false) {
  if (!await seguimientoMensajesPostventaDisponible()) return;
  await query(
    `UPDATE public.mercadolibre_mensaje_postventa_notificado
     SET leido_at = COALESCE(leido_at, NOW()),
         respondido_at = CASE WHEN $3 THEN NOW() ELSE respondido_at END
     WHERE id_cuenta = $1 AND venta_id = $2`,
    [idCuenta, ventaId, respondido],
  );
}

export async function getMercadoLibreVentaConversacion(idCuenta: number, ventaId: string): Promise<MercadoLibreVentaConversacion> {
  const normalizedVentaId = idSeguro(ventaId);
  if (!normalizedVentaId) throw new AppError("La venta de Mercado Libre no es valida.", 400);
  const { rows } = await query<{ venta_id: string; comprador: string | null; envio: string | null; estado: string; items: unknown; datos: unknown; site_id: string }>(
    `SELECT venta.venta_id, venta.comprador, venta.envio, venta.estado, venta.items, venta.datos, cuenta.site_id
     FROM public.mercadolibre_venta venta
     JOIN public.mercadolibre_cuenta cuenta ON cuenta.id = venta.id_cuenta
     WHERE venta.id_cuenta = $1 AND venta.venta_id = $2 LIMIT 1`,
    [idCuenta, normalizedVentaId],
  );
  const venta = rows[0];
  if (!venta) throw new AppError("La venta no existe en la cuenta seleccionada.", 404);
  await actualizarSeguimientoMensajesPostventa(idCuenta, normalizedVentaId);
  const datos = venta.datos && typeof venta.datos === "object" && !Array.isArray(venta.datos) ? venta.datos as Record<string, unknown> : {};
  const shipping = datos.shipping && typeof datos.shipping === "object" && !Array.isArray(datos.shipping) ? datos.shipping as Record<string, unknown> : {};
  const buyer = datos.buyer && typeof datos.buyer === "object" && !Array.isArray(datos.buyer) ? datos.buyer as Record<string, unknown> : {};
  const packId = idSeguro(datos.pack_id) || normalizedVentaId;
  const buyerId = idSeguro(buyer.id);
  const shippingId = idSeguro(shipping.id);
  const items = Array.isArray(venta.items) ? venta.items.map((item) => {
    const value = item && typeof item === "object" ? item as Record<string, unknown> : {};
    return { itemId: typeof value.itemId === "string" ? value.itemId : null, titulo: String(value.titulo || "Sin titulo"), sku: typeof value.sku === "string" ? value.sku : null };
  }) : [];
  const itemIds = items.map((item) => item.itemId).filter((itemId): itemId is string => Boolean(itemId));
  const { rows: publicationRows } = itemIds.length ? await query<{ item_id: string; permalink: string | null; thumbnail_url: string | null }>(
    "SELECT item_id, permalink, thumbnail_url FROM public.mercadolibre_publicacion WHERE id_cuenta = $1 AND item_id = ANY($2::text[])",
    [idCuenta, itemIds],
  ) : { rows: [] as Array<{ item_id: string; permalink: string | null; thumbnail_url: string | null }> };
  const publicationByItem = new Map(publicationRows.map((publication) => [publication.item_id, publication]));
  const { rows: questionRows } = buyerId ? await query<{ pregunta_id: string; item_id: string | null; titulo: string | null; texto: string; respuesta: string | null; fecha: Date | string | null }>(
    `SELECT pregunta_id, item_id, titulo, texto, respuesta, fecha
     FROM public.mercadolibre_pregunta
     WHERE id_cuenta = $1 AND comprador_id::text = $2
     ORDER BY fecha DESC NULLS LAST, id DESC LIMIT 100`,
    [idCuenta, buyerId],
  ) : { rows: [] as Array<{ pregunta_id: string; item_id: string | null; titulo: string | null; texto: string; respuesta: string | null; fecha: Date | string | null }> };
  const { accessToken, sellerId } = await accessTokenForCuenta(idCuenta);
  let tipoEnvio = etiquetaTipoEnvio(shipping);
  if (!tipoEnvio && shippingId) {
    try {
      const detalleEnvio = await meliGet(`/shipments/${encodeURIComponent(shippingId)}`, idCuenta, accessToken);
      if (detalleEnvio && typeof detalleEnvio === "object" && !Array.isArray(detalleEnvio)) tipoEnvio = etiquetaTipoEnvio(detalleEnvio as Record<string, unknown>);
    } catch (error) {
      console.warn("[MERCADOLIBRE] No se pudo obtener el tipo de envio:", error instanceof Error ? error.message : error);
    }
  }
  const payload = await meliGet(`/messages/packs/${encodeURIComponent(packId)}/sellers/${sellerId}?tag=post_sale&mark_as_read=true`, idCuenta, accessToken) as Record<string, unknown>;
  const conversation = payload.conversation_status && typeof payload.conversation_status === "object" && !Array.isArray(payload.conversation_status)
    ? payload.conversation_status as Record<string, unknown>
    : {};
  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  return {
    ventaId: normalizedVentaId,
    packId,
    comprador: nombreComprador(buyer, venta.comprador),
    compradorId: buyerId,
    envio: venta.envio,
    tipoEnvio,
    estado: typeof conversation.status === "string" ? conversation.status : null,
    permiteResponder: conversation.status === "active",
    limiteRespuesta: Number.isFinite(Number(payload.seller_max_message_length)) ? Number(payload.seller_max_message_length) : 350,
    items: items.map((item) => {
      const publication = item.itemId ? publicationByItem.get(item.itemId) : null;
      return { ...item, permalink: publication?.permalink || null, thumbnailUrl: secureThumbnailUrl(publication?.thumbnail_url || null) };
    }),
    mensajes: messages.map((message) => {
      const value = message && typeof message === "object" ? message as Record<string, unknown> : {};
      const from = value.from && typeof value.from === "object" ? value.from as Record<string, unknown> : {};
      const dates = value.message_date && typeof value.message_date === "object" ? value.message_date as Record<string, unknown> : {};
      const attachments = Array.isArray(value.message_attachments) ? value.message_attachments : [];
      return {
        id: String(value.id || value.message_id || crypto.randomUUID()), texto: textoMensajePostVenta(value.text),
        fecha: typeof dates.created === "string" ? dates.created : null, propio: Number(from.user_id) === sellerId,
        adjuntos: attachments.map((attachment) => {
          const current = attachment && typeof attachment === "object" ? attachment as Record<string, unknown> : {};
          const idAdjunto = idAdjuntoSeguro(current.filename) || idAdjuntoSeguro(current.id);
          const nombre = typeof current.original_filename === "string"
            ? current.original_filename
            : typeof current.name === "string"
              ? current.name
              : idAdjunto;
          return {
            nombre,
            tipo: typeof current.type === "string" ? current.type : null,
            url: idAdjunto
              ? `/api/integraciones/mercadolibre/ventas/${encodeURIComponent(normalizedVentaId)}/mensajes/adjuntos/${encodeURIComponent(idAdjunto)}?idCuenta=${idCuenta}`
              : typeof current.url === "string" ? current.url : null,
          };
        }),
      };
    }).sort((left, right) => {
      const leftTime = left.fecha ? new Date(left.fecha).getTime() : 0;
      const rightTime = right.fecha ? new Date(right.fecha).getTime() : 0;
      return leftTime - rightTime;
    }),
    preguntasPrevias: questionRows.map((question) => ({
      preguntaId: question.pregunta_id, itemId: question.item_id, titulo: question.titulo, texto: question.texto,
      respuesta: question.respuesta, fecha: question.fecha ? new Date(question.fecha).toISOString() : null,
    })),
  };
}

export async function getMercadoLibreVentaAdjunto(idCuenta: number, ventaId: string, adjuntoId: string) {
  const normalizedVentaId = idSeguro(ventaId);
  const normalizedAdjuntoId = idAdjuntoSeguro(adjuntoId);
  if (!normalizedVentaId || !normalizedAdjuntoId) throw new AppError("El adjunto de Mercado Libre no es valido.", 400);

  const { rows } = await query<{ site_id: string }>(
    `SELECT cuenta.site_id
     FROM public.mercadolibre_venta venta
     JOIN public.mercadolibre_cuenta cuenta ON cuenta.id = venta.id_cuenta
     WHERE venta.id_cuenta = $1 AND venta.venta_id = $2
     LIMIT 1`,
    [idCuenta, normalizedVentaId],
  );
  const venta = rows[0];
  if (!venta) throw new AppError("La venta no existe en la cuenta seleccionada.", 404);

  const request = async (accessToken: string) => fetch(
    `${API_BASE_URL}/messages/attachments/${encodeURIComponent(normalizedAdjuntoId)}?tag=post_sale&site_id=${encodeURIComponent(venta.site_id)}`,
    { headers: { Authorization: `Bearer ${accessToken}`, Accept: "*/*" }, cache: "no-store" },
  );
  let { accessToken } = await accessTokenForCuenta(idCuenta);
  let response = await request(accessToken);
  if (response.status === 401) {
    ({ accessToken } = await accessTokenForCuenta(idCuenta, true));
    response = await request(accessToken);
  }
  if (!response.ok) throw new AppError(`Mercado Libre no pudo obtener el adjunto (${response.status}).`, response.status === 403 ? 403 : 502);

  return {
    contenido: await response.arrayBuffer(),
    tipo: tipoSeguroAdjunto(response.headers.get("content-type")),
    nombre: normalizedAdjuntoId,
  };
}

export async function enviarMensajeVentaMercadoLibre(idCuenta: number, ventaId: string, texto: string) {
  const conversation = await getMercadoLibreVentaConversacion(idCuenta, ventaId);
  const text = texto.trim();
  if (!text) throw new AppError("El mensaje es obligatorio.", 400);
  if (Array.from(text).length > conversation.limiteRespuesta) throw new AppError(`El mensaje supera el limite permitido de ${conversation.limiteRespuesta} caracteres.`, 400);
  if (!conversation.permiteResponder) throw new AppError("Mercado Libre no habilito esta conversacion para responder.", 409);
  const { accessToken, sellerId } = await accessTokenForCuenta(idCuenta);
  const { rows } = await query<{ site_id: string }>("SELECT site_id FROM public.mercadolibre_cuenta WHERE id = $1", [idCuenta]);
  const agentBySite: Record<string, number> = { MLA: 3037674934, MLB: 3037675074, MLC: 3020819166, MCO: 3037204123, MLM: 3037204279, MLU: 3037204685 };
  const siteId = rows[0]?.site_id || "MLA";
  const recipientId = siteId === "MLA" ? Number(conversation.compradorId) : agentBySite[siteId];
  if (!Number.isInteger(recipientId) || recipientId <= 0) throw new AppError("No se pudo identificar al comprador para enviar el mensaje.", 422);
  await meliPost(`/messages/packs/${encodeURIComponent(conversation.packId)}/sellers/${sellerId}?tag=post_sale`, idCuenta, accessToken, {
    from: { user_id: sellerId }, to: { user_id: recipientId }, text,
  });
  await actualizarSeguimientoMensajesPostventa(idCuenta, conversation.ventaId, true);
  return getMercadoLibreVentaConversacion(idCuenta, ventaId);
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

type MeliTopValue = { id: unknown; name: unknown };

function valuesFromTopValues(payload: unknown): MeliTopValue[] {
  if (!Array.isArray(payload)) return [];
  return payload.filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object"))
    .map((entry) => ({ id: entry.id, name: entry.name }));
}

async function cuentaConectadaParaCatalogoVehiculos() {
  const result = await query<{ id: number }>(`
    SELECT id FROM public.mercadolibre_cuenta
    WHERE conectada = TRUE AND site_id = 'MLA'
    ORDER BY updated_at DESC, id DESC
    LIMIT 1
  `);
  const idCuenta = result.rows[0] ? Number(result.rows[0].id) : 0;
  if (!idCuenta) throw new AppError("Conecta primero una cuenta de Mercado Libre Argentina para consultar el catalogo de vehiculos.", 422);
  return idCuenta;
}

export async function consultarCompatibilidadesPublicacionMercadoLibre(itemId: string, page = 1) {
  const normalizedItemId = itemId.trim().toUpperCase();
  if (!/^MLA\d+$/.test(normalizedItemId)) throw new AppError("Ingresa un identificador MLA valido.", 422);

  const idCuenta = await cuentaConectadaParaCatalogoVehiculos();
  const { accessToken } = await accessTokenForCuenta(idCuenta);
  const limit = 50;
  const offset = (Math.max(1, page) - 1) * limit;
  const payload = await meliGet(`/items/${encodeURIComponent(normalizedItemId)}/compatibilities?extended=true&limit=${limit}&offset=${offset}`, idCuenta, accessToken);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new AppError("Mercado Libre devolvio una respuesta de compatibilidades invalida.", 502);

  const response = payload as Record<string, unknown>;
  const paging = response.paging && typeof response.paging === "object" && !Array.isArray(response.paging)
    ? response.paging as Record<string, unknown>
    : {};
  const total = typeof paging.total === "number" ? paging.total : null;
  return {
    itemId: normalizedItemId,
    products: Array.isArray(response.products) ? response.products : [],
    paging: {
      total,
      limit: typeof paging.limit === "number" ? paging.limit : limit,
      offset: typeof paging.offset === "number" ? paging.offset : offset,
    },
    universal: response.universal ?? null,
  };
}

export async function consultarProductoCatalogoMercadoLibre(catalogProductId: string) {
  const normalizedCatalogProductId = catalogProductId.trim().toUpperCase();
  if (!/^MLA\d+$/.test(normalizedCatalogProductId)) throw new AppError("El identificador de vehiculo de Mercado Libre no es valido.", 422);

  const idCuenta = await cuentaConectadaParaCatalogoVehiculos();
  const { accessToken } = await accessTokenForCuenta(idCuenta);
  const payload = await meliGet(`/products/${encodeURIComponent(normalizedCatalogProductId)}`, idCuenta, accessToken);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new AppError("Mercado Libre devolvio una ficha de vehiculo invalida.", 502);
  return payload as Record<string, unknown>;
}

async function consultarTopValuesVehiculos(idCuenta: number, token: string, attributeId: AtributoVehiculoId, known: ValorVehiculo[]) {
  try {
    const payload = await meliPost(
      `/catalog_domains/${DOMINIO_VEHICULOS_ML}/attributes/${attributeId}/top_values?limit=1000`,
      idCuenta,
      token,
      { known_attributes: known.map((attribute) => ({ id: attribute.id, value_id: attribute.valueId })) },
    );
    const values = valuesFromTopValues(payload);
    await guardarValoresCatalogoVehiculos(attributeId, known, values);
    return values
      .map((value) => ({ id: String(value.id ?? "").trim(), name: String(value.name ?? "").trim() }))
      .filter((value) => value.id && value.name);
  } catch (error) {
    // ML responde intermitentemente 500 en top_values. Los contextos que ya
    // fueron obtenidos siguen siendo validos y permiten continuar la cola.
    const cached = await obtenerValoresCatalogoVehiculos(attributeId, known);
    if (cached.length) return cached;
    throw error;
  }
}

function atributosDesdeDominio(payload: unknown) {
  const record = payload && typeof payload === "object" ? payload as Record<string, unknown> : null;
  const candidates = Array.isArray(payload) ? payload : Array.isArray(record?.attributes) ? record.attributes : [];
  return new Set(candidates
    .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object"))
    .map((entry) => typeof entry.id === "string" ? entry.id : "")
    .filter(Boolean));
}

async function atributosDisponiblesVehiculos(idCuenta: number, token: string) {
  const payload = await meliGet(`/catalog_domains/${DOMINIO_VEHICULOS_ML}`, idCuenta, token);
  const found = atributosDesdeDominio(payload);
  // Si ML cambia el formato de esta respuesta, el endpoint top_values sigue
  // siendo la autoridad y los atributos rechazados se desactivan abajo.
  return found.size ? found : new Set(ATRIBUTOS_VEHICULO_ML.map((attribute) => attribute.id));
}

function atributoNoPerteneceAlDominio(error: unknown) {
  return error instanceof Error && /does not belong to the domain/i.test(error.message);
}

export async function consultarValoresVehiculoMercadoLibre(attributeId: unknown, known: ValorVehiculo[]) {
  if (!esAtributoVehiculo(attributeId)) throw new AppError("El atributo de vehiculo indicado no es valido.", 400);
  const cached = await obtenerValoresCatalogoVehiculos(attributeId, known);
  if (cached.length) return cached;
  const idCuenta = await cuentaConectadaParaCatalogoVehiculos();
  const { accessToken } = await accessTokenForCuenta(idCuenta);
  const available = await atributosDisponiblesVehiculos(idCuenta, accessToken);
  await guardarEstadoAtributosVehiculo(available);
  if (!available.has(attributeId)) throw new AppError(`${attributeId} no esta disponible actualmente para vehiculos de Mercado Libre Argentina.`, 422);
  return consultarTopValuesVehiculos(idCuenta, accessToken, attributeId, known);
}

function contextosVehiculo(known: ValorVehiculo[], excludedAttribute?: AtributoVehiculoId, maxContexts = 100) {
  const byAttribute = new Map<AtributoVehiculoId, ValorVehiculo[]>();
  for (const entry of known.flatMap((value) => normalizarAtributosVehiculo([value])).filter((value) => value.id !== excludedAttribute)) {
    const values = byAttribute.get(entry.id) ?? [];
    if (!values.some((value) => value.valueId === entry.valueId)) values.push(entry);
    byAttribute.set(entry.id, values);
  }

  let contexts: ValorVehiculo[][] = [[]];
  for (const attribute of ATRIBUTOS_VEHICULO_ML.map((item) => item.id)) {
    const values = byAttribute.get(attribute);
    if (!values?.length) continue;
    contexts = contexts.flatMap((context) => values.map((value) => [...context, value]));
    if (contexts.length > maxContexts) throw new AppError(`Selecciona hasta ${maxContexts} combinaciones de filtros antes de cargar otra lista.`, 422);
  }
  return contexts;
}

export async function consultarValoresVehiculoMercadoLibreParaContextos(attributeId: unknown, known: ValorVehiculo[]) {
  if (!esAtributoVehiculo(attributeId)) throw new AppError("El atributo de vehiculo indicado no es valido.", 400);
  const contexts = contextosVehiculo(known, attributeId);
  const values: Array<Array<{ id: string; name: string }>> = [];
  // Evita saturar la API de Mercado Libre cuando el usuario combina modelos y años.
  for (let start = 0; start < contexts.length; start += 5) {
    values.push(...await Promise.all(contexts.slice(start, start + 5).map((context) => consultarValoresVehiculoMercadoLibre(attributeId, context))));
  }
  const unique = new Map<string, { id: string; name: string }>();
  for (const entry of values.flat()) unique.set(entry.id, entry);
  return [...unique.values()].sort((left, right) => left.name.localeCompare(right.name, "es-AR"));
}

export async function detallarVehiculosMercadoLibre(filters: ValorVehiculo[]) {
  const contexts = contextosVehiculo(filters, undefined, 100);
  const idCuenta = await cuentaConectadaParaCatalogoVehiculos();
  const { accessToken } = await accessTokenForCuenta(idCuenta);
  const available = await atributosDisponiblesVehiculos(idCuenta, accessToken);
  await guardarEstadoAtributosVehiculo(available);
  const consultarDetalle = async (attributeId: AtributoVehiculoId, context: ValorVehiculo[]) => {
    const cached = await obtenerValoresCatalogoVehiculos(attributeId, context);
    if (cached.length || !available.has(attributeId)) return cached;
    return consultarTopValuesVehiculos(idCuenta, accessToken, attributeId, context);
  };
  const rows: Array<{ atributos: ValorVehiculo[] }> = [];
  for (const context of contexts) {
    const byAttribute = new Map(context.map((value) => [value.id, value]));
    const completed = await Promise.all(ATRIBUTOS_VEHICULO_ML.map(async (attribute) => {
      const selected = byAttribute.get(attribute.id);
      if (selected) return selected;
      try {
        const values = await consultarDetalle(attribute.id, context);
        if (!values.length) return null;
        return {
          id: attribute.id,
          valueId: values.map((value) => value.id).join(","),
          valueName: values.map((value) => value.name).join(" / "),
        } satisfies ValorVehiculo;
      } catch {
        // Un atributo no disponible no impide mostrar los demas datos del vehiculo.
        return null;
      }
    }));
    rows.push({ atributos: completed.filter((value): value is ValorVehiculo => value !== null) });
  }
  return rows;
}

type TareaCargaVehiculo = {
  id: number;
  id_vehiculo_base?: number | null;
  atributos: unknown;
  siguiente_atributo_id: AtributoVehiculoId | "SAVE";
  prioridad: number;
};

const LIMITE_RUTAS_POR_CARGA = 50;
const LIMITE_VEHICULOS_POR_CARGA = 65;
const ESPERA_ENTRE_CONSULTAS_CATALOGO_MS = 900;
const SECUENCIA_CARGA_BASE: AtributoVehiculoId[] = [
  "MODEL",
  "VEHICLE_YEAR",
  "ENGINE",
  "POWER",
];
const SECUENCIA_ENRIQUECIMIENTO_VEHICULOS: AtributoVehiculoId[] = [
  "SHORT_VERSION",
  "FUEL_TYPE",
  "VEHICLE_BODY_TYPE",
  "TRANSMISSION_CONTROL_TYPE",
  "GEAR_NUMBER",
  "DOORS",
  "STEERING",
  "TRACTION_CONTROL",
  "VALVES_PER_CYLINDER",
];

function proximoAtributoCarga(attributeId: TareaCargaVehiculo["siguiente_atributo_id"]): TareaCargaVehiculo["siguiente_atributo_id"] {
  const index = SECUENCIA_CARGA_BASE.indexOf(attributeId as AtributoVehiculoId);
  return index < 0 ? "SAVE" : SECUENCIA_CARGA_BASE[index + 1] ?? "SAVE";
}

function proximoAtributoEnriquecimiento(attributeId: TareaCargaVehiculo["siguiente_atributo_id"]): TareaCargaVehiculo["siguiente_atributo_id"] {
  const index = SECUENCIA_ENRIQUECIMIENTO_VEHICULOS.indexOf(attributeId as AtributoVehiculoId);
  return index < 0 ? "SAVE" : SECUENCIA_ENRIQUECIMIENTO_VEHICULOS[index + 1] ?? "SAVE";
}

async function encolarCargaVehiculos(entries: Array<{
  atributos: ValorVehiculo[];
  siguienteAtributo: TareaCargaVehiculo["siguiente_atributo_id"];
  prioridad: number;
}>) {
  const normalized = entries
    .map((entry) => ({
      atributos: normalizarAtributosVehiculo(entry.atributos),
      siguienteAtributo: entry.siguienteAtributo,
      prioridad: entry.prioridad,
    }))
    .filter((entry) => entry.atributos.length)
    .map((entry) => ({ ...entry, firma: firmaCompatibilidadVehiculo(entry.atributos) }));
  if (!normalized.length) return;

  await query(`
    INSERT INTO public.mercadolibre_catalogo_vehiculo_cola AS cola
      (dominio_id, atributos, firma, siguiente_atributo_id, prioridad, estado, updated_at)
    SELECT $1, value->'atributos', value->>'firma', value->>'siguienteAtributo',
           (value->>'prioridad')::smallint, 'PENDIENTE', NOW()
    FROM jsonb_array_elements($2::jsonb) AS value
    ON CONFLICT (dominio_id, firma, siguiente_atributo_id) DO UPDATE
    SET estado = CASE
          WHEN cola.estado = 'ERROR' THEN 'PENDIENTE'
          ELSE cola.estado
        END,
        ultimo_error = CASE
          WHEN cola.estado = 'ERROR' THEN NULL
          ELSE cola.ultimo_error
        END,
        updated_at = NOW()
  `, [DOMINIO_VEHICULOS_ML, JSON.stringify(normalized)]);
}

async function encolarEnriquecimientoVehiculos(entries: Array<{
  idVehiculo: number;
  atributos: ValorVehiculo[];
  siguienteAtributo: TareaCargaVehiculo["siguiente_atributo_id"];
  prioridad: number;
}>) {
  const normalized = entries
    .map((entry) => ({
      idVehiculo: entry.idVehiculo,
      atributos: normalizarAtributosVehiculo(entry.atributos),
      siguienteAtributo: entry.siguienteAtributo,
      prioridad: entry.prioridad,
    }))
    .filter((entry) => entry.idVehiculo > 0 && entry.atributos.length)
    .map((entry) => ({ ...entry, firma: firmaCompatibilidadVehiculo(entry.atributos) }));
  if (!normalized.length) return;

  await query(`
    INSERT INTO public.mercadolibre_catalogo_vehiculo_enriquecimiento_cola AS cola
      (dominio_id, id_vehiculo_base, atributos, firma, siguiente_atributo_id, prioridad, estado, updated_at)
    SELECT $1, (value->>'idVehiculo')::bigint, value->'atributos', value->>'firma', value->>'siguienteAtributo',
           (value->>'prioridad')::smallint, 'PENDIENTE', NOW()
    FROM jsonb_array_elements($2::jsonb) AS value
    ON CONFLICT (dominio_id, firma, siguiente_atributo_id) DO UPDATE
    SET estado = CASE WHEN cola.estado = 'ERROR' THEN 'PENDIENTE' ELSE cola.estado END,
        ultimo_error = CASE WHEN cola.estado = 'ERROR' THEN NULL ELSE cola.ultimo_error END,
        updated_at = NOW()
  `, [DOMINIO_VEHICULOS_ML, JSON.stringify(normalized)]);
}

async function tomarTareaCargaVehiculo() {
  return withTransaction(async (db) => {
    const result = await db.query<TareaCargaVehiculo>(`
      WITH siguiente AS (
        SELECT id
        FROM public.mercadolibre_catalogo_vehiculo_cola
        WHERE dominio_id = $1 AND estado = 'PENDIENTE'
        ORDER BY prioridad DESC, id DESC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE public.mercadolibre_catalogo_vehiculo_cola cola
      SET estado = 'PROCESANDO', intentos = intentos + 1, updated_at = NOW()
      FROM siguiente
      WHERE cola.id = siguiente.id
      RETURNING cola.id, NULL::bigint AS id_vehiculo_base, cola.atributos, cola.siguiente_atributo_id, cola.prioridad
    `, [DOMINIO_VEHICULOS_ML]);
    return result.rows[0] ?? null;
  });
}

async function finalizarTareaCargaVehiculo(id: number, error?: unknown) {
  const message = error instanceof Error ? error.message.slice(0, 1_000) : null;
  await query(`
    UPDATE public.mercadolibre_catalogo_vehiculo_cola
    SET estado = $2, ultimo_error = $3, updated_at = NOW()
    WHERE id = $1
  `, [id, message ? "ERROR" : "COMPLETADA", message]);
}

async function tomarTareaEnriquecimientoVehiculo() {
  return withTransaction(async (db) => {
    const result = await db.query<TareaCargaVehiculo>(`
      WITH siguiente AS (
        SELECT id
        FROM public.mercadolibre_catalogo_vehiculo_enriquecimiento_cola
        WHERE dominio_id = $1 AND estado = 'PENDIENTE'
        ORDER BY prioridad DESC, id DESC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE public.mercadolibre_catalogo_vehiculo_enriquecimiento_cola cola
      SET estado = 'PROCESANDO', intentos = intentos + 1, updated_at = NOW()
      FROM siguiente
      WHERE cola.id = siguiente.id
      RETURNING cola.id, cola.id_vehiculo_base, cola.atributos, cola.siguiente_atributo_id, cola.prioridad
    `, [DOMINIO_VEHICULOS_ML]);
    return result.rows[0] ?? null;
  });
}

async function finalizarTareaEnriquecimientoVehiculo(id: number, error?: unknown) {
  const message = error instanceof Error ? error.message.slice(0, 1_000) : null;
  await query(`
    UPDATE public.mercadolibre_catalogo_vehiculo_enriquecimiento_cola
    SET estado = $2, ultimo_error = $3, updated_at = NOW()
    WHERE id = $1
  `, [id, message ? "ERROR" : "COMPLETADA", message]);
}

async function estadoEnriquecimientoVehiculos() {
  const result = await query<{ pendientes: string; procesando: string; errores: string }>(`
    SELECT
      COUNT(*) FILTER (WHERE estado = 'PENDIENTE')::text AS pendientes,
      COUNT(*) FILTER (WHERE estado = 'PROCESANDO')::text AS procesando,
      COUNT(*) FILTER (WHERE estado = 'ERROR')::text AS errores
    FROM public.mercadolibre_catalogo_vehiculo_enriquecimiento_cola
    WHERE dominio_id = $1
  `, [DOMINIO_VEHICULOS_ML]);
  const current = result.rows[0] ?? { pendientes: "0", procesando: "0", errores: "0" };
  const pendientes = Number(current.pendientes);
  const procesando = Number(current.procesando);
  const errores = Number(current.errores);
  return { pendientes, procesando, errores, completada: !pendientes && !procesando && !errores };
}

async function actualizarEstadoCatalogoVehiculos(ids: Iterable<number>, estado: "BASE" | "DETALLADO") {
  const uniqueIds = [...new Set([...ids].filter((id) => Number.isInteger(id) && id > 0))];
  if (!uniqueIds.length) return;
  await query(`
    UPDATE public.mercadolibre_catalogo_vehiculo
    SET estado = $2, sincronizado_at = NOW()
    WHERE id = ANY($1::bigint[])
  `, [uniqueIds, estado]);
}

async function estadoCargaVehiculos(totalMarcas: number, ultimoError: string | null = null) {
  const queue = await query<{ pendientes: string; procesando: string; errores: string }>(`
    SELECT
      COUNT(*) FILTER (WHERE estado = 'PENDIENTE')::text AS pendientes,
      COUNT(*) FILTER (WHERE estado = 'PROCESANDO')::text AS procesando,
      COUNT(*) FILTER (WHERE estado = 'ERROR')::text AS errores
    FROM public.mercadolibre_catalogo_vehiculo_cola
    WHERE dominio_id = $1
  `, [DOMINIO_VEHICULOS_ML]);
  const current = queue.rows[0] ?? { pendientes: "0", procesando: "0", errores: "0" };
  const pendientes = Number(current.pendientes);
  const procesando = Number(current.procesando);
  const errores = Number(current.errores);
  const estado = pendientes || procesando ? "EN_PROCESO" : errores ? "ERROR" : "COMPLETADA";
  await query(`
    INSERT INTO public.mercadolibre_catalogo_vehiculo_sincronizacion
      (dominio_id, estado, siguiente_marca, total_marcas, ultimo_error, iniciada_at, finalizada_at, updated_at)
    VALUES ($1, $2, $3, $3, $4, NOW(), CASE WHEN $2 = 'COMPLETADA' THEN NOW() ELSE NULL END, NOW())
    ON CONFLICT (dominio_id) DO UPDATE
    SET estado = EXCLUDED.estado,
        siguiente_marca = EXCLUDED.siguiente_marca,
        total_marcas = EXCLUDED.total_marcas,
        ultimo_error = EXCLUDED.ultimo_error,
        iniciada_at = CASE WHEN EXCLUDED.estado = 'EN_PROCESO' THEN COALESCE(mercadolibre_catalogo_vehiculo_sincronizacion.iniciada_at, NOW()) ELSE mercadolibre_catalogo_vehiculo_sincronizacion.iniciada_at END,
        finalizada_at = CASE WHEN EXCLUDED.estado = 'COMPLETADA' THEN NOW() ELSE NULL END,
        updated_at = NOW()
  `, [DOMINIO_VEHICULOS_ML, estado, totalMarcas, ultimoError]);
  return { pendientes, procesando, errores, completada: estado === "COMPLETADA" };
}

type MarcaObjetivoVehiculo = {
  marca_nombre: string;
};

function claveMarcaObjetivo(value: string) {
  return value.trim().toLocaleLowerCase("es-AR");
}

async function marcasObjetivoVehiculos() {
  const result = await query<MarcaObjetivoVehiculo>(`
    SELECT marca_nombre
    FROM public.mercadolibre_catalogo_vehiculo_marca_objetivo
    WHERE dominio_id = $1 AND activa = TRUE
    ORDER BY marca_nombre
  `, [DOMINIO_VEHICULOS_ML]);
  return result.rows.map((row) => row.marca_nombre);
}

async function actualizarIdsMarcasObjetivo(brands: Array<{ id: string; name: string }>) {
  if (!brands.length) return;
  await query(`
    UPDATE public.mercadolibre_catalogo_vehiculo_marca_objetivo AS destino
    SET marca_id = origen.id, updated_at = NOW()
    FROM jsonb_to_recordset($2::jsonb) AS origen(id text, name text)
    WHERE destino.dominio_id = $1
      AND lower(trim(destino.marca_nombre)) = lower(trim(origen.name))
  `, [DOMINIO_VEHICULOS_ML, JSON.stringify(brands)]);
}

export async function sincronizarCatalogoVehiculosMercadoLibre(reiniciar = false) {
  const idCuenta = await cuentaConectadaParaCatalogoVehiculos();
  const { accessToken } = await accessTokenForCuenta(idCuenta);
  const available = await atributosDisponiblesVehiculos(idCuenta, accessToken);
  await guardarEstadoAtributosVehiculo(available);
  if (!available.has("BRAND")) throw new AppError("Mercado Libre no informo el atributo BRAND para el dominio de vehiculos.", 502);

  // Recupera tareas que Vercel pudo interrumpir y permite reintentar fallas
  // transitorias en la siguiente pulsacion, sin repetir las ya completas.
  await query(`
    UPDATE public.mercadolibre_catalogo_vehiculo_cola
    SET estado = 'PENDIENTE', updated_at = NOW()
    WHERE dominio_id = $1
      AND ((estado = 'PROCESANDO' AND updated_at < NOW() - INTERVAL '10 minutes')
        OR (estado = 'ERROR' AND intentos < 3))
  `, [DOMINIO_VEHICULOS_ML]);
  if (reiniciar) {
    await query("DELETE FROM public.mercadolibre_catalogo_vehiculo_cola WHERE dominio_id = $1", [DOMINIO_VEHICULOS_ML]);
  }

  const brands = await consultarTopValuesVehiculos(idCuenta, accessToken, "BRAND", []);
  const targetNames = await marcasObjetivoVehiculos();
  if (!targetNames.length) throw new AppError("No hay marcas seleccionadas para cargar el catalogo de vehiculos.", 422);
  const targets = new Set(targetNames.map(claveMarcaObjetivo));
  const targetBrands = brands.filter((brand) => targets.has(claveMarcaObjetivo(brand.name)));
  const missingBrands = targetNames.filter((name) => !targetBrands.some((brand) => claveMarcaObjetivo(brand.name) === claveMarcaObjetivo(name)));
  if (!targetBrands.length) throw new AppError("Mercado Libre no devolvio ninguna de las marcas seleccionadas.", 502);
  await actualizarIdsMarcasObjetivo(targetBrands);
  const existing = await query<{ total: string }>(`
    SELECT COUNT(*)::text AS total
    FROM public.mercadolibre_catalogo_vehiculo_cola
    WHERE dominio_id = $1
  `, [DOMINIO_VEHICULOS_ML]);
  if (!Number(existing.rows[0]?.total ?? 0)) {
    await encolarCargaVehiculos(targetBrands.map((brand) => ({
      atributos: [{ id: "BRAND" as const, valueId: brand.id, valueName: brand.name }],
      siguienteAtributo: "MODEL" as const,
      prioridad: 1,
    })));
  }

  let rutasConsultadas = 0;
  let tareasProcesadas = 0;
  let vehiculosGenerados = 0;
  try {
    while (rutasConsultadas < LIMITE_RUTAS_POR_CARGA && vehiculosGenerados < LIMITE_VEHICULOS_POR_CARGA) {
      const task = await tomarTareaCargaVehiculo();
      if (!task) break;
      try {
        const attributes = normalizarAtributosVehiculo(task.atributos);
        if (task.siguiente_atributo_id === "SAVE") {
          const saved = await withTransaction((db) => guardarVehiculosCanonicos(db, [attributes], "API"));
          await actualizarEstadoCatalogoVehiculos(saved.values(), "BASE");
          await encolarEnriquecimientoVehiculos([...saved.entries()].map(([, idVehiculo]) => ({
            idVehiculo,
            atributos: attributes,
            siguienteAtributo: "SHORT_VERSION",
            prioridad: 1,
          })));
          vehiculosGenerados += saved.size;
          tareasProcesadas += 1;
          await finalizarTareaCargaVehiculo(task.id);
          continue;
        }

        const currentAttribute = task.siguiente_atributo_id;
        if (!available.has(currentAttribute)) {
          await encolarCargaVehiculos([{
            atributos: attributes,
            siguienteAtributo: proximoAtributoCarga(currentAttribute),
            prioridad: task.prioridad + 1,
          }]);
          tareasProcesadas += 1;
          await finalizarTareaCargaVehiculo(task.id);
          continue;
        }

        let values: Array<{ id: string; name: string }>;
        try {
          values = await consultarTopValuesVehiculos(idCuenta, accessToken, currentAttribute, attributes);
        } catch (error) {
          if (!atributoNoPerteneceAlDominio(error)) throw error;
          available.delete(currentAttribute);
          await guardarEstadoAtributosVehiculo(available);
          await encolarCargaVehiculos([{
            atributos: attributes,
            siguienteAtributo: proximoAtributoCarga(currentAttribute),
            prioridad: task.prioridad + 1,
          }]);
          tareasProcesadas += 1;
          await finalizarTareaCargaVehiculo(task.id);
          continue;
        }
        rutasConsultadas += 1;
        const nextAttribute = proximoAtributoCarga(currentAttribute);
        const children = values.map((value) => ({
          atributos: [...attributes, { id: currentAttribute, valueId: value.id, valueName: value.name }],
          siguienteAtributo: nextAttribute,
          prioridad: task.prioridad + 1,
        }));
        if (!children.length) {
          children.push({ atributos: attributes, siguienteAtributo: nextAttribute, prioridad: task.prioridad + 1 });
        }
        await encolarCargaVehiculos(children);
        tareasProcesadas += 1;
        await finalizarTareaCargaVehiculo(task.id);
        // Deja margen para filtros y demas llamadas de la misma aplicacion ML.
        await new Promise((resolve) => setTimeout(resolve, ESPERA_ENTRE_CONSULTAS_CATALOGO_MS));
      } catch (error) {
        await finalizarTareaCargaVehiculo(task.id, error);
        throw error;
      }
    }
    const status = await estadoCargaVehiculos(targetBrands.length);
    return { rutasConsultadas, tareasProcesadas, vehiculosGenerados, totalMarcas: targetBrands.length, marcasNoEncontradas: missingBrands, ...status };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1_000) : "No se pudo continuar la carga incremental.";
    await estadoCargaVehiculos(targetBrands.length, message);
    throw error;
  }
}

export async function enriquecerCatalogoVehiculosMercadoLibre() {
  const idCuenta = await cuentaConectadaParaCatalogoVehiculos();
  const { accessToken } = await accessTokenForCuenta(idCuenta);
  const available = await atributosDisponiblesVehiculos(idCuenta, accessToken);
  await guardarEstadoAtributosVehiculo(available);
  await query(`
    UPDATE public.mercadolibre_catalogo_vehiculo_enriquecimiento_cola
    SET estado = 'PENDIENTE', updated_at = NOW()
    WHERE dominio_id = $1
      AND ((estado = 'PROCESANDO' AND updated_at < NOW() - INTERVAL '10 minutes')
        OR (estado = 'ERROR' AND intentos < 3))
  `, [DOMINIO_VEHICULOS_ML]);

  let rutasConsultadas = 0;
  let tareasProcesadas = 0;
  let vehiculosGenerados = 0;
  try {
    while (rutasConsultadas < LIMITE_RUTAS_POR_CARGA && vehiculosGenerados < LIMITE_VEHICULOS_POR_CARGA) {
      const task = await tomarTareaEnriquecimientoVehiculo();
      if (!task) break;
      try {
        const attributes = normalizarAtributosVehiculo(task.atributos);
        if (task.siguiente_atributo_id === "SAVE") {
          const saved = await withTransaction((db) => guardarVehiculosCanonicos(db, [attributes], "API"));
          await actualizarEstadoCatalogoVehiculos(saved.values(), "DETALLADO");
          vehiculosGenerados += saved.size;
          tareasProcesadas += 1;
          await finalizarTareaEnriquecimientoVehiculo(task.id);
          continue;
        }

        const currentAttribute = task.siguiente_atributo_id;
        const nextAttribute = proximoAtributoEnriquecimiento(currentAttribute);
        const idVehiculoBase = Number(task.id_vehiculo_base ?? 0);
        if (!idVehiculoBase) throw new AppError("La tarea de enriquecimiento no tiene un vehiculo base.", 500);
        if (!available.has(currentAttribute)) {
          await encolarEnriquecimientoVehiculos([{ idVehiculo: idVehiculoBase, atributos: attributes, siguienteAtributo: nextAttribute, prioridad: task.prioridad + 1 }]);
          tareasProcesadas += 1;
          await finalizarTareaEnriquecimientoVehiculo(task.id);
          continue;
        }

        let values: Array<{ id: string; name: string }>;
        try {
          values = await consultarTopValuesVehiculos(idCuenta, accessToken, currentAttribute, attributes);
        } catch (error) {
          if (!atributoNoPerteneceAlDominio(error)) throw error;
          available.delete(currentAttribute);
          await guardarEstadoAtributosVehiculo(available);
          await encolarEnriquecimientoVehiculos([{ idVehiculo: idVehiculoBase, atributos: attributes, siguienteAtributo: nextAttribute, prioridad: task.prioridad + 1 }]);
          tareasProcesadas += 1;
          await finalizarTareaEnriquecimientoVehiculo(task.id);
          continue;
        }
        rutasConsultadas += 1;
        const children = values.map((value) => ({
          idVehiculo: idVehiculoBase,
          atributos: [...attributes, { id: currentAttribute, valueId: value.id, valueName: value.name }],
          siguienteAtributo: nextAttribute,
          prioridad: task.prioridad + 1,
        }));
        if (!children.length) children.push({ idVehiculo: idVehiculoBase, atributos: attributes, siguienteAtributo: nextAttribute, prioridad: task.prioridad + 1 });
        await encolarEnriquecimientoVehiculos(children);
        tareasProcesadas += 1;
        await finalizarTareaEnriquecimientoVehiculo(task.id);
        await new Promise((resolve) => setTimeout(resolve, ESPERA_ENTRE_CONSULTAS_CATALOGO_MS));
      } catch (error) {
        await finalizarTareaEnriquecimientoVehiculo(task.id, error);
        throw error;
      }
    }
    const status = await estadoEnriquecimientoVehiculos();
    return { rutasConsultadas, tareasProcesadas, vehiculosGenerados, ...status };
  } catch (error) {
    throw error;
  }
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
    atributosDescripcion: atributosParaDescripcion(item.attributes),
    compatibilidades: compat === null ? null : {
      total: typeof paging?.total === "number" ? paging.total : null,
      muestras: products.length,
      vendedor: products.filter((product) => product.source === "SELLER").length,
      catalogo: products.filter((product) => product.source === "CATALOGO").reduce((sum, product) => sum + (Number(product.total) || 1), 0),
      sinOrigen: products.filter((product) => product.source !== "SELLER" && product.source !== "CATALOGO").length,
    },
  };
}

function textAttribute(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizarAtributosCategoriaPublicacion(payload: unknown): AtributoCategoriaPublicacion[] {
  if (!Array.isArray(payload)) return [];
  return payload.flatMap((value): AtributoCategoriaPublicacion[] => {
    if (!value || typeof value !== "object") return [];
    const source = value as Record<string, unknown>;
    const id = textAttribute(source.id);
    if (!id) return [];
    const tags = source.tags && typeof source.tags === "object" ? source.tags as Record<string, unknown> : {};
    const values = Array.isArray(source.values) ? source.values.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const candidate = item as Record<string, unknown>;
      const valueId = textAttribute(candidate.id);
      const valueName = textAttribute(candidate.name);
      return valueId && valueName ? [{ id: valueId, nombre: valueName }] : [];
    }) : [];
    const unidadesPermitidas = Array.isArray(source.allowed_units) ? source.allowed_units.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const candidate = item as Record<string, unknown>;
      const id = textAttribute(candidate.id);
      const name = textAttribute(candidate.name);
      return [id, name].filter(Boolean);
    }) : [];
    const maxLength = Number(source.value_max_length);
    return [{
      id,
      nombre: textAttribute(source.name) || id,
      requerido: tags.required === true || tags.new_required === true,
      soloLectura: tags.read_only === true,
      inferido: tags.inferred === true,
      tipoValor: textAttribute(source.value_type),
      longitudMaxima: Number.isFinite(maxLength) && maxLength > 0 ? maxLength : null,
      valores: values,
      unidadesPermitidas: [...new Set(unidadesPermitidas)],
    }];
  });
}

async function atributosCategoriaPublicacion(categoryId: unknown, idCuenta: number, token: string) {
  const id = textAttribute(categoryId);
  if (!id) return [];
  const cached = categoryAttributesCache.get(id);
  if (cached && cached.expiresAt > Date.now()) return cached.values;
  try {
    const values = normalizarAtributosCategoriaPublicacion(await meliGet(`/categories/${encodeURIComponent(id)}/attributes`, idCuenta, token));
    categoryAttributesCache.set(id, { values, expiresAt: Date.now() + CATEGORY_ATTRIBUTES_CACHE_MS });
    return values;
  } catch {
    // Nunca se bloquea una duplicacion solo porque no se pudo leer la ficha de la categoria.
    return [];
  }
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
  const atributosCategoria = await atributosCategoriaPublicacion(item.category_id, idCuenta, accessToken);
  try { body = prepararValidacionPublicacion(item, nombre, atributosCategoria); }
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
    atributosObligatoriosFaltantes: atributosObligatoriosFaltantes(atributosCategoria, body),
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
  const atributosCategoria = await atributosCategoriaPublicacion(item.category_id, idCuenta, accessToken);
  const body = prepararValidacionPublicacion(item, nombre, atributosCategoria);
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
    const compatibilidades = await copiarCompatibilidadesDePublicacion(publication.item_id, item.user_product_id, data.id, data.user_product_id, item.category_id, idCuenta, accessToken);
    return { resultado: "CREADA", publicacion: data.id, titulo: typeof data.title === "string" ? data.title : null, userProductId: typeof data.user_product_id === "string" ? data.user_product_id : null, estado: typeof data.status === "string" ? data.status : null, descripcionEstado, compatibilidades };
  }
  if (response.status >= 500 || response.ok) {
    return { resultado: "INCIERTO", status: response.status, mensaje: "Mercado Libre no confirmo el resultado. Revisa la cuenta antes de volver a intentar.", respuesta: safeData };
  }
  return { resultado: "RECHAZADA", status: response.status, respuesta: safeData };
}

async function copiarCompatibilidadesDePublicacion(sourceId: string, sourceUp: unknown, targetId: string, targetUp: unknown, categoria: unknown, idCuenta: number, token: string) {
  let etapa = "consulta";
  try {
    const [source, target] = await Promise.all([
      meliGet(`/items/${encodeURIComponent(sourceId)}/compatibilities?limit=1`, idCuenta, token),
      meliGet(`/items/${encodeURIComponent(targetId)}/compatibilities?limit=1`, idCuenta, token),
    ]);
    let origen = totalCompatibilidades(source);
    let destino = totalCompatibilidades(target);
    let dominios: string[] = [];
    if ((origen === null || destino === null) && !(typeof sourceUp === "string" && sourceUp && sourceUp === targetUp)) {
      const dump = await meliGet("/catalog/dumps/domains/MLA/compatibilities", idCuenta, token);
      dominios = dominiosCompatibles(dump, categoria);
      if (dominios.length) {
        const summaries = await Promise.all(dominios.map((domain_id) => meliPost("/items/compatibilities_summary", idCuenta, token, { domain_id, items: [sourceId, targetId] })));
        const sourceCounts = summaries.map((summary) => totalResumen(summary, sourceId));
        const targetCounts = summaries.map((summary) => totalResumen(summary, targetId));
        if (origen === null && sourceCounts.every((count) => count !== null)) origen = sourceCounts.reduce<number>((sum, count) => sum + (count ?? 0), 0);
        if (destino === null && targetCounts.every((count) => count !== null)) destino = targetCounts.reduce<number>((sum, count) => sum + (count ?? 0), 0);
      }
    }
    const plan = planCopiaCompatibilidades(sourceUp, targetUp, origen, destino);
    if (plan === "COMPARTIDAS") return { estado: "COMPARTIDAS", origen, destino };
    if (plan === "SIN_ORIGEN") return { estado: "SIN_ORIGEN", origen, destino };
    if (plan === "DESCONOCIDO") {
      const faltantes = [
        origen === null ? "total de compatibilidades del origen" : null,
        destino === null ? "total de compatibilidades del destino" : null,
        typeof sourceUp === "string" && sourceUp && !(typeof targetUp === "string" && targetUp) ? "User Product del destino" : null,
      ].filter(Boolean);
      return { estado: "NO_VERIFICADA", origen, destino, detalle: `No se intento copiar. Datos no informados por Mercado Libre: ${faltantes.join(", ")}.` };
    }
    let ruta = `/items/${encodeURIComponent(targetId)}/compatibilities`;
    let metodo = plan === "ACTUALIZAR" ? "PUT" : "POST";
    const itemToCopy = { item_id: sourceId, extended_information: true };
    let cuerpo: Record<string, unknown> = plan === "ACTUALIZAR" ? { create: { item_to_copy: itemToCopy } } : { item_to_copy: itemToCopy };
    if (typeof targetUp === "string" && targetUp) {
      if (!dominios.length) dominios = dominiosCompatibles(await meliGet("/catalog/dumps/domains/MLA/compatibilities", idCuenta, token), categoria);
      if (typeof categoria !== "string" || dominios.length !== 1) return { estado: "NO_VERIFICADA", origen, destino, detalle: "No se intento copiar: no se pudo identificar un unico dominio compatible para la categoria." };
      const solicitud = solicitudCopiaUserProduct(sourceId, sourceUp, targetUp, categoria, dominios[0]);
      ruta = solicitud.path;
      metodo = "POST";
      cuerpo = solicitud.body;
    }
    etapa = "copia";
    const copy = await fetch(`${API_BASE_URL}${ruta}`, {
      method: metodo,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(cuerpo),
      cache: "no-store",
    });
    if (!copy.ok) {
      const data = await copy.json().catch(() => null) as { message?: unknown; error?: unknown } | null;
      const detalle = typeof data?.message === "string" ? data.message : typeof data?.error === "string" ? data.error : "Mercado Libre rechazo la copia.";
      return { estado: "ERROR", origen, destino, status: copy.status, detalle: String(protegerDiagnostico(detalle, [token])) };
    }
    try {
      const updated = await meliGet(`/items/${encodeURIComponent(targetId)}/compatibilities?limit=1`, idCuenta, token);
      let totalActualizado = totalCompatibilidades(updated);
      if (totalActualizado === null && dominios.length) {
        const summaries = await Promise.all(dominios.map((domain_id) => meliPost("/items/compatibilities_summary", idCuenta, token, { domain_id, items: [targetId] })));
        const counts = summaries.map((summary) => totalResumen(summary, targetId));
        if (counts.every((count) => count !== null)) totalActualizado = counts.reduce<number>((sum, count) => sum + (count ?? 0), 0);
      }
      return totalActualizado === null ? { estado: "SOLICITADA_SIN_VERIFICAR", origen, destino: null } : { estado: "SOLICITADA", origen, destino: totalActualizado };
    } catch { return { estado: "SOLICITADA_SIN_VERIFICAR", origen, destino: null }; }
  } catch (error) { return { estado: "NO_VERIFICADA", origen: null, destino: null, detalle: etapa === "copia" ? "No se recibio respuesta de la copia. Revisa el destino antes de reintentar." : error instanceof AppError ? error.message : "No se pudo consultar origen o destino." }; }
}

async function prepararMensajeVenta(idCuenta: number, ventaId: string) {
  const { accessToken, sellerId } = await accessTokenForCuenta(idCuenta);
  const order = await meliGet(`/orders/${encodeURIComponent(ventaId)}`, idCuenta, accessToken) as Record<string, unknown>;
  const seller = order.seller as { id?: unknown } | undefined;
  if (Number(seller?.id) !== sellerId) throw new AppError("La venta no pertenece a la cuenta conectada.", 403);
  if (order.status !== "paid") throw new AppError("La venta no figura como pagada; no se enviara el mensaje.", 400);
  const rawPack = order.pack_id ?? ventaId;
  if ((typeof rawPack === "number" && !Number.isSafeInteger(rawPack)) || !/^\d+$/.test(String(rawPack))) throw new AppError("No se pudo identificar el paquete de forma segura.", 400);
  const packId = String(rawPack);
  const guide = await meliGet(`/messages/action_guide/packs/${encodeURIComponent(packId)}?tag=post_sale`, idCuenta, accessToken);
  const { disponible, limite } = opcionMensajePersonalizado(guide);
  const previous = await query<{ estado: string; detalle: string | null }>("SELECT estado, detalle FROM public.mercadolibre_mensaje_prueba WHERE id_cuenta = $1 AND pack_id = $2", [idCuenta, packId]);
  return { accessToken, packId, disponible, limite, anterior: previous.rows[0] || null };
}

export async function enviarMensajeVentaPrueba(idCuenta: number, ventaId: string, texto: string) {
  const { accessToken, packId, disponible, limite, anterior } = await prepararMensajeVenta(idCuenta, ventaId);
  if (anterior) throw new AppError(`Ya existe un intento para este paquete (${anterior.estado}). Revisa los mensajes en Mercado Libre.`, 409);
  if (!disponible) throw new AppError("Mercado Libre no habilito un mensaje personalizado para esta venta.", 400);
  if (Array.from(texto).length > limite) throw new AppError(`El mensaje supera el limite permitido de ${limite} caracteres.`, 400);
  const reserved = await query<{ id: string }>(`INSERT INTO public.mercadolibre_mensaje_prueba (id_cuenta, pack_id, venta_id, texto, estado)
    VALUES ($1, $2, $3, $4, 'INCIERTO') ON CONFLICT (id_cuenta, pack_id) DO NOTHING RETURNING id`, [idCuenta, packId, ventaId, texto]);
  if (!reserved.rows.length) throw new AppError("Ya existe un intento para este paquete. Revisa los mensajes en Mercado Libre.", 409);
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/messages/action_guide/packs/${encodeURIComponent(packId)}/option?tag=post_sale`, {
      method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ option_id: "OTHER", text: texto }), cache: "no-store", signal: AbortSignal.timeout(20000),
    });
  } catch {
    return { estado: "INCIERTO", detalle: "No se recibio respuesta. Revisa Mercado Libre antes de volver a enviar." };
  }
  const body = await response.json().catch(() => null) as Record<string, unknown> | null;
  const estado = response.ok ? "RECIBIDO" : response.status >= 500 ? "INCIERTO" : "RECHAZADO";
  const rawDetalle = response.ok ? `Estado en Mercado Libre: ${typeof body?.status === "string" ? body.status : "sin informar"}.` : typeof body?.message === "string" ? body.message : `HTTP ${response.status}`;
  const detalle = String(protegerDiagnostico(rawDetalle, [accessToken]));
  await query("UPDATE public.mercadolibre_mensaje_prueba SET estado = $2, detalle = $3, mensaje_id = $4, updated_at = NOW() WHERE id = $1", [reserved.rows[0].id, estado, detalle, typeof body?.id === "string" ? body.id : null]);
  return { estado, detalle };
}

const MENSAJE_COMPATIBILIDAD_DEFAULT = "Gracias por tu compra!\nPara confirmar que este sea el producto correcto nos puedes indicar numero de chasis, modelo, año, version y motorizacion!\nEstamos atentos!";
type ConfigMensajeAutomatico = { activo: boolean; texto: string; activado_at: Date | string | null };

export async function obtenerMensajesAutomaticos(idCuenta: number) {
  const config = await query<ConfigMensajeAutomatico>("SELECT activo, texto, activado_at FROM public.mercadolibre_mensaje_automatico_config WHERE id_cuenta = $1", [idCuenta]);
  const eventos = await query<{ venta_id: string; estado: string; detalle: string | null; updated_at: Date }>(
    "SELECT venta_id, estado, detalle, updated_at FROM public.mercadolibre_mensaje_automatico_evento WHERE id_cuenta = $1 ORDER BY updated_at DESC LIMIT 20", [idCuenta],
  );
  return { config: config.rows[0] || { activo: false, texto: MENSAJE_COMPATIBILIDAD_DEFAULT, activado_at: null }, eventos: eventos.rows };
}

export async function configurarMensajesAutomaticos(idCuenta: number, activo: boolean, texto: string) {
  const cuentas = await query("SELECT 1 FROM public.mercadolibre_cuenta WHERE id = $1 AND conectada = TRUE", [idCuenta]);
  if (!cuentas.rowCount) throw new AppError("La cuenta no esta conectada.", 404);
  await query(`INSERT INTO public.mercadolibre_mensaje_automatico_config (id_cuenta, activo, texto, activado_at)
    VALUES ($1, $2, $3, CASE WHEN $2 THEN NOW() ELSE NULL END)
    ON CONFLICT (id_cuenta) DO UPDATE SET activo = EXCLUDED.activo, texto = EXCLUDED.texto,
      activado_at = CASE WHEN EXCLUDED.activo AND NOT mercadolibre_mensaje_automatico_config.activo THEN NOW() ELSE mercadolibre_mensaje_automatico_config.activado_at END,
      updated_at = NOW()`, [idCuenta, activo, texto]);
  return obtenerMensajesAutomaticos(idCuenta);
}

async function obtenerConfigMensajeAutomatico(idCuenta: number) {
  const result = await query<ConfigMensajeAutomatico>("SELECT activo, texto, activado_at FROM public.mercadolibre_mensaje_automatico_config WHERE id_cuenta = $1 AND activo = TRUE", [idCuenta]);
  return result.rows[0] || null;
}

async function procesarMensajeAutomatico(idCuenta: number, venta: MeliOrder, config: ConfigMensajeAutomatico | null) {
  if (!config?.activo || !config.activado_at || venta.status !== "paid" || !venta.id || !venta.date_created) return;
  if (!ventaAptaParaMensaje(venta.status, venta.date_created, config.activado_at)) return;
  config = await obtenerConfigMensajeAutomatico(idCuenta);
  if (!config?.activo || !config.activado_at) return;
  if (typeof venta.id === "number" && !Number.isSafeInteger(venta.id)) return;
  if (!ventaAptaParaMensaje(venta.status, venta.date_created, config.activado_at)) return;
  const ventaId = String(venta.id);
  const previo = await query("SELECT 1 FROM public.mercadolibre_mensaje_prueba WHERE id_cuenta = $1 AND venta_id = $2", [idCuenta, ventaId]);
  if (previo.rowCount) return;
  let estado = "ERROR", detalle = "No se pudo consultar o enviar el mensaje.";
  try {
    const result = await enviarMensajeVentaPrueba(idCuenta, ventaId, config.texto);
    estado = result.estado; detalle = result.detalle;
  } catch (error) {
    detalle = error instanceof AppError ? error.message : "No se pudo consultar o enviar el mensaje.";
  }
  await query(`INSERT INTO public.mercadolibre_mensaje_automatico_evento (id_cuenta, venta_id, estado, detalle)
    VALUES ($1, $2, $3, $4) ON CONFLICT (id_cuenta, venta_id) DO UPDATE SET estado = EXCLUDED.estado, detalle = EXCLUDED.detalle, updated_at = NOW()
    WHERE EXCLUDED.estado <> 'ERROR' OR mercadolibre_mensaje_automatico_evento.estado = 'ERROR'`, [idCuenta, ventaId, estado, detalle]);
}

export async function reintentarCompatibilidades(idPublicacion: number, tipo: "ITEM" | "KIT", id: number, destino: string) {
  const column = tipo === "KIT" ? "id_kit" : "id_producto";
  const result = await query<{ id_cuenta: number; item_id: string }>(
    `SELECT id_cuenta, item_id FROM public.mercadolibre_publicacion WHERE id = $1 AND ${column} = $2`, [idPublicacion, id],
  );
  const publication = result.rows[0];
  if (!publication) throw new AppError("La publicacion de origen no esta vinculada a este item o grupo.", 404);
  if (publication.item_id === destino) throw new AppError("El origen y el destino deben ser diferentes.", 400);
  const idCuenta = Number(publication.id_cuenta);
  const { accessToken, sellerId } = await accessTokenForCuenta(idCuenta);
  const [source, target] = await Promise.all([
    meliGet(`/items/${encodeURIComponent(publication.item_id)}`, idCuenta, accessToken),
    meliGet(`/items/${encodeURIComponent(destino)}`, idCuenta, accessToken),
  ]) as [Record<string, unknown>, Record<string, unknown>];
  if (Number(source.seller_id) !== sellerId || Number(target.seller_id) !== sellerId) throw new AppError("Ambas publicaciones deben pertenecer a la cuenta conectada.", 403);
  if (!source.category_id || source.category_id !== target.category_id) throw new AppError("Las publicaciones no tienen la misma categoria; no se intento copiar.", 400);
  return copiarCompatibilidadesDePublicacion(publication.item_id, source.user_product_id, destino, target.user_product_id, source.category_id, idCuenta, accessToken);
}

async function meliPost(path: string, idCuenta: number, token: string, body: Record<string, unknown>) {
  const request = async (accessToken: string) => fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  let accessToken = token;
  let response = await request(accessToken);
  if (response.status === 401) {
    const renewed = await accessTokenForCuenta(idCuenta, true);
    accessToken = renewed.accessToken;
    response = await request(accessToken);
  }
  if (path.includes("/top_values")) {
    const retryDelays = [1_500, 3_000, 6_000, 12_000];
    for (const fallbackDelay of retryDelays) {
      if (response.ok || ![429, 500, 502, 503, 504].includes(response.status)) break;
      const retryAfterSeconds = Number(response.headers.get("retry-after"));
      const delay = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? Math.max(fallbackDelay, retryAfterSeconds * 1_000)
        : fallbackDelay;
      await new Promise((resolve) => setTimeout(resolve, delay));
      response = await request(accessToken);
      if (response.status === 401) {
        const renewed = await accessTokenForCuenta(idCuenta, true);
        accessToken = renewed.accessToken;
        response = await request(accessToken);
      }
    }
  }
  if (!response.ok) {
    const details = await response.json().catch(() => null) as { message?: unknown } | null;
    const message = typeof details?.message === "string" ? ` ${details.message}` : "";
    throw new AppError(`Mercado Libre no pudo completar la respuesta (${response.status}).${message}`, response.status === 403 || response.status === 429 ? response.status : 502);
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

type MeliMensajePostVenta = {
  id?: string;
  message_id?: string;
  from?: { user_id?: number | string };
  text?: unknown;
  resource_id?: number | string;
  message_resources?: Array<{ id?: number | string; name?: string }>;
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
  let configMensaje: ConfigMensajeAutomatico | null = null;
  try { configMensaje = await obtenerConfigMensajeAutomatico(idCuenta); } catch (error) { console.error("[MENSAJES ML] No se pudo consultar la configuracion:", error); }
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
    if (configMensaje) {
      try { await procesarMensajeAutomatico(idCuenta, venta, configMensaje); } catch (error) { console.error("[MENSAJES ML] No se pudo procesar una venta:", error); }
    }
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

  // Mercado Libre deja de devolver las preguntas cerradas en la consulta de pendientes.
  // Solo conciliamos las recientes para no alterar registros historicos fuera de la ventana activa.
  const pendientesIds = pendientes
    .filter((pregunta) => pregunta.id)
    .map((pregunta) => String(pregunta.id));
  await query(
    `UPDATE public.mercadolibre_pregunta
     SET estado = 'CLOSED', sincronizada_at = NOW(), updated_at = NOW()
     WHERE id_cuenta = $1
       AND estado = 'UNANSWERED'
       AND fecha >= NOW() - INTERVAL '30 days'
       AND NOT (pregunta_id = ANY($2::text[]))`,
    [idCuenta, pendientesIds],
  );
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
  if (topic === "messages") return /^[A-Za-z0-9-]{8,200}$/.test(recurso);
  return false;
}

function valueRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function notificarMensajePostVentaMercadoLibre(idCuenta: number, sellerId: number, recurso: string, accessToken: string) {
  const response = await meliGet(`/messages/${encodeURIComponent(recurso)}?tag=post_sale`, idCuenta, accessToken);
  const payload = valueRecord(response);
  const messages = Array.isArray(payload.messages) ? payload.messages : [payload];
  const message = valueRecord(messages[0]) as MeliMensajePostVenta;
  const messageId = String(message.id || message.message_id || recurso).trim();
  const from = valueRecord(message.from);
  if (!messageId || Number(from.user_id) === sellerId) return;

  const reserved = await query<{ id: number }>(
    `INSERT INTO public.mercadolibre_mensaje_postventa_notificado (id_cuenta, mensaje_id, venta_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (id_cuenta, mensaje_id) DO NOTHING
     RETURNING id`,
    [idCuenta, messageId, idSeguro(message.resource_id)],
  );
  if (!reserved.rows.length) return;

  const resources = Array.isArray(message.message_resources) ? message.message_resources : [];
  const packId = resources.find((resource) => resource?.name?.toLowerCase() === "packs")?.id;
  const identifiers = Array.from(new Set([idSeguro(message.resource_id), idSeguro(packId)].filter((value): value is string => Boolean(value))));
  const sale = identifiers.length ? await query<{ venta_id: string; comprador: string | null; items: unknown }>(
    `SELECT venta_id, comprador, items
     FROM public.mercadolibre_venta
     WHERE id_cuenta = $1
       AND (venta_id = ANY($2::text[]) OR NULLIF(datos->>'pack_id', '') = ANY($2::text[]))
     ORDER BY fecha DESC NULLS LAST, id DESC
     LIMIT 1`,
    [idCuenta, identifiers],
  ) : { rows: [] as Array<{ venta_id: string; comprador: string | null; items: unknown }> };
  const venta = sale.rows[0];
  const firstItem = Array.isArray(venta?.items) ? valueRecord(venta.items[0]) : {};
  const itemId = typeof firstItem.itemId === "string" ? firstItem.itemId : null;
  const publication = itemId ? await query<{ titulo: string | null; thumbnail_url: string | null }>(
    "SELECT titulo, thumbnail_url FROM public.mercadolibre_publicacion WHERE id_cuenta = $1 AND item_id = $2 LIMIT 1",
    [idCuenta, itemId],
  ) : { rows: [] as Array<{ titulo: string | null; thumbnail_url: string | null }> };
  const publicacion = publication.rows[0];
  const texto = textoMensajePostVenta(message.text).trim();
  await notificarNuevoMensajePostVentaMercadoLibre({
    idCuenta,
    mensajeId: messageId,
    ventaId: venta?.venta_id || idSeguro(message.resource_id),
    titulo: venta?.comprador ? `Mensaje de ${venta.comprador}` : publicacion?.titulo || "Nuevo mensaje de postventa",
    thumbnailUrl: secureThumbnailUrl(publicacion?.thumbnail_url || null),
    texto,
  });
}

async function procesarEventoMercadoLibreReclamado(row: MeliWebhookEventRow) {
  const { accessToken, sellerId } = await accessTokenForCuenta(row.id_cuenta);
  if (!recursoPermitido(row.topic, row.recurso)) {
    await query(
      "UPDATE public.mercadolibre_webhook_evento SET estado = 'IGNORADO', procesado_at = NOW(), ultimo_error = NULL WHERE id = $1",
      [row.id],
    );
    return;
  }
  const resource = row.topic === "messages" ? null : await meliGet(row.recurso, row.id_cuenta, accessToken);
  if (row.topic === "orders_v2") {
    const venta = resource as MeliOrder;
    await guardarVentaMercadoLibre(row.id_cuenta, venta);
    try { await procesarMensajeAutomatico(row.id_cuenta, venta, await obtenerConfigMensajeAutomatico(row.id_cuenta)); }
    catch (error) { console.error("[MENSAJES ML] No se pudo procesar una venta:", error); }
  }
  if (row.topic === "questions") await guardarPreguntaMercadoLibre(row.id_cuenta, resource as MeliQuestion, { notificar: true });
  if (row.topic === "items") await guardarPublicacionDesdeWebhook(row.id_cuenta, resource as MeliItem);
  if (row.topic === "messages") await notificarMensajePostVentaMercadoLibre(row.id_cuenta, sellerId, row.recurso, accessToken);
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
