import "server-only";
import { AppError } from "@/lib/api-errors";
import { query, withTransaction, type DbClient } from "@/lib/db-utils";

const REQUEST_TIMEOUT_MS = 15_000;
const RUN_STALE_AFTER_MS = 10 * 60 * 1000;

type GesuHeader = { data_tot?: unknown; data_pag?: unknown; data_ini?: unknown; data_fin?: unknown };
type GesuPersona = {
  id?: unknown;
  relacion?: unknown;
  tipoPersona?: unknown;
  razonSocial?: unknown;
  tipoDocumento?: unknown;
  nroDocumento?: unknown;
  condicionFiscal?: unknown;
  comprobanteDefecto?: unknown;
  domicilio?: unknown;
  localidad?: unknown;
  provincia?: unknown;
  codPostal?: unknown;
  telefono?: unknown;
  celular?: unknown;
  email?: unknown;
  listaPrecios?: unknown;
  bonificacionGeneral?: unknown;
  contacto1_nombre?: unknown;
  contacto1_telefono?: unknown;
  contacto1_celular?: unknown;
  contacto1_email?: unknown;
  contacto2_nombre?: unknown;
  contacto2_telefono?: unknown;
  contacto2_celular?: unknown;
  contacto2_email?: unknown;
  contacto3_nombre?: unknown;
  contacto3_telefono?: unknown;
  contacto3_celular?: unknown;
  contacto3_email?: unknown;
};

type GesuResponse = { header?: GesuHeader; data?: Record<string, GesuPersona> };
type SyncState = { pagina_actual: number; ciclo: number };
type PriceType = { id: number; descripcion: string };

function clean(value: unknown) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

function normalized(value: unknown) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleUpperCase("es-AR");
}

function isClient(persona: GesuPersona) {
  return normalized(persona.relacion).includes("CLIENTE");
}

function toPositiveInteger(value: unknown) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function getContact(persona: GesuPersona) {
  for (const index of [1, 2, 3] as const) {
    const nombre = clean(persona[`contacto${index}_nombre`]);
    const telefono = clean(persona[`contacto${index}_telefono`]);
    const celular = clean(persona[`contacto${index}_celular`]);
    const email = clean(persona[`contacto${index}_email`]);
    if (nombre || telefono || celular || email) return { nombre, telefono, celular, email };
  }
  return { nombre: null, telefono: null, celular: null, email: null };
}

function fiscalCondition(value: unknown) {
  const condition = normalized(value).replaceAll(" ", "_");
  return ["RESPONSABLE_INSCRIPTO", "MONOTRIBUTO", "EXENTO", "CONSUMIDOR_FINAL", "NO_RESPONSABLE"].includes(condition) ? condition : null;
}

function defaultReceipt(value: unknown) {
  const receipt = normalized(value).replaceAll(" ", "_");
  return receipt === "FACTURA_A" || receipt === "FACTURA_B" ? receipt : null;
}

function personType(value: unknown): "FISICA" | "JURIDICA" {
  return normalized(value) === "JURIDICA" ? "JURIDICA" : "FISICA";
}

function percentage(value: unknown) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) && amount >= 0 && amount <= 100 ? amount : 0;
}

function endpointFor(page: number) {
  const endpoint = clean(process.env.GESU_CLIENTES_API_URL);
  const token = clean(process.env.GESU_CLIENTES_API_TOKEN);
  if (!endpoint) throw new AppError("Falta GESU_CLIENTES_API_URL en la configuracion.", 503);
  if (!token) throw new AppError("Falta GESU_CLIENTES_API_TOKEN en la configuracion.", 503);
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new AppError("GESU_CLIENTES_API_URL no tiene un formato valido.", 503);
  }
  url.searchParams.set("pag", String(page));
  url.searchParams.set("token", token);
  return url;
}

async function fetchPage(page: number): Promise<{ header: GesuHeader; records: GesuPersona[] }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(endpointFor(page), { signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new AppError(`GESU devolvio HTTP ${response.status} al consultar clientes.`, 502);
    const payload = await response.json() as GesuResponse;
    if (!payload || typeof payload !== "object" || !payload.header || !payload.data || typeof payload.data !== "object") {
      throw new AppError("GESU devolvio una respuesta de clientes invalida.", 502);
    }
    return { header: payload.header, records: Object.values(payload.data) };
  } catch (error) {
    if (error instanceof AppError) throw error;
    const message = error instanceof Error && error.name === "AbortError" ? "La consulta de clientes a GESU excedio el tiempo limite." : "No se pudo consultar clientes en GESU.";
    throw new AppError(message, 502);
  } finally {
    clearTimeout(timeout);
  }
}

async function claimNextPage() {
  const staleAt = new Date(Date.now() - RUN_STALE_AFTER_MS);
  const result = await query<SyncState>(`
    UPDATE public.gesu_clientes_sincronizacion
    SET ejecutando_at = now(), updated_at = now()
    WHERE id = true AND (ejecutando_at IS NULL OR ejecutando_at < $1)
    RETURNING pagina_actual, ciclo
  `, [staleAt]);
  return result.rows[0] ?? null;
}

async function markFailure(error: unknown) {
  const message = error instanceof Error ? error.message : "Error desconocido al sincronizar clientes desde GESU.";
  await query("UPDATE public.gesu_clientes_sincronizacion SET ejecutando_at = NULL, ultimo_error = $1, updated_at = now() WHERE id = true", [message]);
}

async function importInitialClients(client: DbClient, records: GesuPersona[]) {
  const priceTypes = await client.query<PriceType>("SELECT id, descripcion FROM public.tipo_precio");
  const pricesByName = new Map(priceTypes.rows.map((price) => [normalized(price.descripcion), price.id]));
  let newClients = 0;
  let knownClients = 0;
  let invalidRecords = 0;

  for (const persona of records) {
    if (!isClient(persona)) continue;
    const gesuId = toPositiveInteger(persona.id);
    const razonSocial = clean(persona.razonSocial);
    if (!gesuId || !razonSocial) { invalidRecords += 1; continue; }
    const contact = getContact(persona);
    const result = await client.query<{ inserted: boolean }>(`
      INSERT INTO public.clientes (
        gesu_id, razon_social, tipo_persona, tipo_documento, documento, condicion_iva, comprobante_default,
        domicilio, localidad, provincia, codigo_postal, telefono, celular, email,
        contacto_nombre, contacto_telefono, contacto_celular, contacto_email,
        id_tipo_precio, bonificacion_general, activo, importado_desde_gesu, ultima_sincronizacion_gesu
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, true, true, now()
      )
      ON CONFLICT (gesu_id) DO UPDATE
      SET ultima_sincronizacion_gesu = EXCLUDED.ultima_sincronizacion_gesu,
          updated_at = now()
      RETURNING (xmax = 0) AS inserted
    `, [
      gesuId, razonSocial, personType(persona.tipoPersona), normalized(persona.tipoDocumento) || null, clean(persona.nroDocumento), fiscalCondition(persona.condicionFiscal), defaultReceipt(persona.comprobanteDefecto),
      clean(persona.domicilio), clean(persona.localidad), clean(persona.provincia), clean(persona.codPostal), clean(persona.telefono), clean(persona.celular), clean(persona.email),
      contact.nombre, contact.telefono, contact.celular, contact.email,
      pricesByName.get(normalized(persona.listaPrecios)) ?? null, percentage(persona.bonificacionGeneral),
    ]);
    if (result.rows[0]?.inserted) newClients += 1;
    else knownClients += 1;
  }
  return { newClients, knownClients, invalidRecords };
}

export async function sincronizarClientesGesu() {
  const state = await claimNextPage();
  if (!state) return { skipped: true, reason: "Ya hay una sincronizacion de clientes en curso." };
  try {
    const response = await fetchPage(state.pagina_actual);
    const total = toPositiveInteger(response.header.data_tot);
    const perPage = toPositiveInteger(response.header.data_pag);
    if (!total || !perPage) throw new AppError("GESU no informo encabezados validos para clientes.", 502);
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    if (state.pagina_actual > totalPages) throw new AppError("La pagina de clientes configurada excede el total informado por GESU.", 502);
    const imported = await withTransaction((client) => importInitialClients(client, response.records));
    const completed = state.pagina_actual >= totalPages;
    await query(`
      UPDATE public.gesu_clientes_sincronizacion
      SET pagina_actual = $1,
          total_paginas = $2,
          ciclo = CASE WHEN $3 THEN ciclo + 1 ELSE ciclo END,
          ultima_sincronizacion_at = now(),
          ultima_sincronizacion_completa_at = CASE WHEN $3 THEN now() ELSE ultima_sincronizacion_completa_at END,
          ejecutando_at = NULL,
          ultimo_error = NULL,
          updated_at = now()
      WHERE id = true
    `, [completed ? 1 : state.pagina_actual + 1, totalPages, completed]);
    return { skipped: false, page: state.pagina_actual, totalPages, total, completed, ...imported };
  } catch (error) {
    await markFailure(error);
    throw error;
  }
}
