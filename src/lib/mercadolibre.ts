import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

import { AppError } from "@/lib/api-errors";
import { query, withTransaction } from "@/lib/db-utils";
import type {
  MercadoLibreCuentaEstado,
  MercadoLibrePublicacion,
  MercadoLibrePublicacionesResult,
  MercadoLibreSyncResult,
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
  seller_custom_field?: string | null;
  attributes?: Array<{ id?: string; value_name?: string | null }>;
  variations?: Array<Record<string, unknown>>;
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

export async function getMercadoLibrePublicaciones(idCuenta: number, page = 1, limit = 50): Promise<MercadoLibrePublicacionesResult> {
  const totalResult = await query<{ total_count: number }>(
    "SELECT COUNT(*)::int AS total_count FROM public.mercadolibre_publicacion WHERE id_cuenta = $1",
    [idCuenta]
  );
  const totalCount = Number(totalResult.rows[0]?.total_count || 0);
  if (!totalCount) return { data: [], totalCount: 0, totalPages: 0 };
  const safePage = Math.max(1, page);
  const { rows } = await query(
    `SELECT publication.id, publication.item_id, publication.id_producto, publication.id_kit, publication.tipo_vinculo, publication.seller_sku,
      publication.titulo, publication.estado, publication.categoria_id, publication.tipo_publicacion, publication.precio,
      publication.precio_original, publication.moneda, publication.cantidad_disponible, publication.cantidad_vendida,
      publication.thumbnail_url, publication.permalink, publication.variaciones, publication.sincronizada_at,
      product.cod_unico AS codigo_producto, product.descripcion AS producto,
      kit.codigo_kit AS codigo_kit, kit.nombre AS kit
     FROM public.mercadolibre_publicacion publication
     LEFT JOIN public.productos product ON product.id = publication.id_producto
     LEFT JOIN public.kits kit ON kit.id = publication.id_kit
     WHERE publication.id_cuenta = $1
     ORDER BY publication.sincronizada_at DESC, publication.item_id ASC
     LIMIT $2 OFFSET $3`,
    [idCuenta, limit, (safePage - 1) * limit]
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
      cantidadVendida: row.cantidad_vendida === null ? null : Number(row.cantidad_vendida), thumbnailUrl: row.thumbnail_url ? String(row.thumbnail_url) : null,
      permalink: row.permalink ? String(row.permalink) : null, variaciones: Array.isArray(row.variaciones) ? row.variaciones : [],
      sincronizadaAt: new Date(String(row.sincronizada_at)).toISOString(),
    })),
    totalCount,
    totalPages: Math.ceil(totalCount / limit),
  };
}

export async function getMercadoLibreVinculos(tipo: "ITEM" | "KIT", id: number) {
  const column = tipo === "KIT" ? "id_kit" : "id_producto";
  const { rows } = await query<{ item_id: string; titulo: string; estado: string; permalink: string | null; seller_sku: string | null }>(
    `SELECT item_id, titulo, estado, permalink, seller_sku
     FROM public.mercadolibre_publicacion
     WHERE ${column} = $1
     ORDER BY estado = 'active' DESC, titulo ASC`,
    [id]
  );
  return rows.map((row) => ({
    itemId: String(row.item_id),
    titulo: String(row.titulo),
    estado: String(row.estado),
    permalink: row.permalink ? String(row.permalink) : null,
    sellerSku: row.seller_sku ? String(row.seller_sku) : null,
  }));
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
  if (!response.ok) throw new AppError(`Mercado Libre no pudo devolver publicaciones (${response.status}).`, 502);
  return response.json() as Promise<unknown>;
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
    thumbnailUrl: item.thumbnail || null, permalink: item.permalink || null, variaciones: item.variations || [],
  };
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

async function productIdsByCode(codes: string[]) {
  if (!codes.length) return new Map<string, number>();
  const { rows } = await query<{ id: number; cod_unico: string }>(
    `SELECT id, cod_unico FROM public.productos
     WHERE UPPER(TRIM(cod_unico)) = ANY($1::text[]) AND COALESCE(oculto_por_kit, FALSE) = FALSE`,
    [codes]
  );
  return new Map(rows.map((row) => [normalizeCode(row.cod_unico), Number(row.id)]));
}

async function kitIdsByCode(codes: string[]) {
  if (!codes.length) return new Map<string, number>();
  const { rows } = await query<{ id: number; codigo_kit: string }>(
    `SELECT id, codigo_kit FROM public.kits
     WHERE UPPER(TRIM(codigo_kit)) = ANY($1::text[]) AND COALESCE(activo, TRUE) = TRUE`,
    [codes]
  );
  return new Map(rows.map((row) => [normalizeCode(row.codigo_kit), Number(row.id)]));
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
    const publications = items.map(mapPublicacion);
    const codes = publications.map((item) => normalizeCode(item.sellerSku)).filter(Boolean);
    const [products, kits] = await Promise.all([productIdsByCode(codes), kitIdsByCode(codes)]);
    let linked = 0;

    for (const item of publications) {
      const code = normalizeCode(item.sellerSku);
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
          id_producto = CASE WHEN mercadolibre_publicacion.tipo_vinculo = 'MANUAL' THEN mercadolibre_publicacion.id_producto ELSE EXCLUDED.id_producto END,
          id_kit = CASE WHEN mercadolibre_publicacion.tipo_vinculo = 'MANUAL' THEN mercadolibre_publicacion.id_kit ELSE EXCLUDED.id_kit END,
          tipo_vinculo = CASE WHEN mercadolibre_publicacion.tipo_vinculo = 'MANUAL' THEN 'MANUAL' ELSE EXCLUDED.tipo_vinculo END,
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

    const result = { total: publications.length, vinculadasPorCodigo: linked, sinVinculo: publications.length - linked, errores: errors };
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
