import "server-only";
import { createClient } from "@supabase/supabase-js";
import { revalidateTag } from "next/cache";
import { AppError } from "@/lib/api-errors";
import { query, withTransaction } from "@/lib/db-utils";

const ORIGIN = "GESU_EXTERNO";
const TABLE = "gesu_items_raw";
const PAGE_SIZE = 1000;
const MAX_ROWS = 50000;
const SAMPLE_LIMIT = 80;
const IMPORT_LIMIT = 500;

type Status = "LISTA" | "REVISAR" | "SIN_DATOS";
type Type = "PRODUCTO" | "GRUPO";
type Component = { code: string; quantity: number };
type ComponentSummary = { items: Component[]; count: number; unresolved: string[]; status: "LISTO" | "REVISAR"; manual: boolean };
type ExternalCatalogApiConfig = { baseUrl: string; token: string };
type RawRow = {
  id: string | number;
  sync_run_id: string | number | null;
  imported_at: string | null;
  codigo_interno: string | null;
  codigo_barras: string | null;
  stock: string | number | null;
  marca: string | null;
  titulo: string | null;
  tipo: string | null;
  payload: unknown;
};
type Item = {
  sourceId: string;
  code: string;
  title: string;
  description: string;
  brand: string;
  category: string;
  subcategory: string;
  barcode: string;
  keywords: string;
  stock: number;
  location: string;
  provider: string;
  providerCode: string;
  type: Type;
  sourceComponents: Component[];
};
type Staged = Item & {
  status: Status;
  subcategoryId: number | null;
  brandId: number | null;
  exists: boolean;
  localProductId: number | null;
  components: ComponentSummary;
};
type Snapshot = {
  id: number;
  sync_run_id: string;
  fecha_origen: string | null;
  total_registros: number;
  ignorados: unknown;
  errores: unknown;
  error_count: number;
};
type StagedProduct = {
  id: number;
  external_id: string;
  codigo: string;
  descripcion: string;
  marca: string | null;
  categoria: string | null;
  subcategoria: string | null;
  codigo_barras: string | null;
  palabras_clave: string | null;
  stock: number;
  ubicacion: string | null;
  proveedor: string | null;
  codigo_proveedor: string | null;
  estado_clasificacion: Status;
  id_marca: number | null;
  id_subcategoria: number | null;
};
type ManualClassification = {
  subcategoryId: number;
  category: string;
  subcategory: string;
};

export type CatalogProduct = {
  id: number;
  code: string;
  description: string;
  brand: string;
  category: string;
  subcategory: string;
  stock: number;
  location: string;
  provider: string;
  providerCode: string;
  classification: Status;
  brandIsNew: boolean;
};
export type CatalogGroup = {
  id: number;
  code: string;
  description: string;
  category: string;
  subcategory: string;
  componentsDetail: Component[];
  components: number;
  unresolvedComponents: string[];
  status: "LISTO" | "REVISAR";
  hasManualComponents: boolean;
};
export type ExternalCatalogPreview = {
  snapshotId: number;
  syncRunId: string;
  importedAt: string | null;
  sourceRows: number;
  products: { total: number; existing: number; new: number; classificationReady: number; classificationPending: number };
  groups: { total: number; existing: number; new: number; ready: number; review: number };
  ignored: Array<{ type: string; count: number }>;
  errors: string[];
  errorCount: number;
  productsToReview: CatalogProduct[];
  groupsToReview: CatalogGroup[];
};
export type CatalogProductsPage = { data: CatalogProduct[]; page: number; totalPages: number; totalCount: number };
export type CatalogGroupsPage = { data: CatalogGroup[]; page: number; totalPages: number; totalCount: number };
export type CatalogImportResult = {
  created: number;
  skippedExisting: number;
  invalidSelection: number;
  brandsCreated: number;
  providersCreated: number;
  providersLinked: number;
  locationsCreated: number;
  stockImported: number;
  ignoredBarcodes: number;
};
export type CatalogImportResponse = CatalogImportResult & { preview: ExternalCatalogPreview };
export type CatalogGroupImportResult = { created: number; skippedExisting: number; invalidSelection: number; componentsLinked: number; preview: ExternalCatalogPreview };

const clean = (value: unknown) => String(value ?? "").trim();
const nullable = (value: unknown) => clean(value) || null;
const normalize = (value: unknown) => clean(value)
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/\s+/g, " ")
  .toUpperCase();
const stockValue = (value: unknown) => {
  const parsed = Number(String(value ?? "").trim().replace(",", "."));
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
};

function payload(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function pick(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = clean(source[key]);
    if (value) return value;
  }
  return "";
}

function externalCatalogApiConfig(): ExternalCatalogApiConfig | null {
  const baseUrl = clean(process.env.EXTERNAL_CATALOG_API_URL).replace(/\/+$/, "");
  const token = clean(process.env.EXTERNAL_CATALOG_API_TOKEN);
  if (!baseUrl && !token) return null;
  if (!baseUrl || !token) {
    throw new AppError("Faltan EXTERNAL_CATALOG_API_URL o EXTERNAL_CATALOG_API_TOKEN en la configuracion del proyecto.", 503);
  }
  try {
    const url = new URL(baseUrl);
    const localUrl = url.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    if (url.protocol !== "https:" && !localUrl) throw new Error("invalid protocol");
  } catch {
    throw new AppError("EXTERNAL_CATALOG_API_URL no tiene un formato valido.", 503);
  }
  return { baseUrl, token };
}

function externalSupabaseClient() {
  const url = clean(process.env.EXTERNAL_SUPABASE_URL);
  const key = clean(process.env.EXTERNAL_SUPABASE_KEY);
  if (!url || !key) throw new AppError("Faltan EXTERNAL_SUPABASE_URL o EXTERNAL_SUPABASE_KEY en la configuracion del proyecto.", 503);
  try { new URL(url); } catch { throw new AppError("EXTERNAL_SUPABASE_URL no tiene un formato valido.", 503); }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
}

function parseRow(row: RawRow): Item | null {
  const data = payload(row.payload);
  const rawType = normalize(pick(data, ["tipo"]) || row.tipo);
  if (rawType !== "PRODUCTO" && rawType !== "GRUPO") return null;
  const code = normalize(pick(data, ["codigoInterno", "codigo_interno"]) || row.codigo_interno);
  const title = pick(data, ["titulo"]) || clean(row.titulo);
  return {
    sourceId: String(row.id),
    code,
    title,
    description: pick(data, ["descripcion"]) || title || code,
    brand: pick(data, ["marca"]) || clean(row.marca),
    category: pick(data, ["categoria", "categoría"]),
    subcategory: pick(data, ["subCategoria", "subcategoria", "subCategoría"]),
    barcode: pick(data, ["codigoBarras", "codigo_barras"]) || clean(row.codigo_barras),
    keywords: pick(data, ["palabrasClave", "palabras_clave"]),
    stock: stockValue(data.stock ?? row.stock),
    location: pick(data, ["ubicacionInterna", "ubicacion_interna"]),
    provider: pick(data, ["proveedor"]),
    providerCode: pick(data, ["codigoProveedor", "codigo_proveedor"]),
    type: rawType,
    sourceComponents: cleanComponents(data.componentes ?? data.components),
  };
}

function parseComponents(title: string): Component[] {
  const detected = new Map<string, number>();
  for (const match of title.toUpperCase().matchAll(/([A-Z0-9+._/-]+?)\s*X\s*(\d+)(?=\s|$)/g)) {
    const code = normalize(match[1]);
    const quantity = Number(match[2]);
    if (code && Number.isInteger(quantity) && quantity > 0) detected.set(code, (detected.get(code) ?? 0) + quantity);
  }
  return Array.from(detected, ([code, quantity]) => ({ code, quantity }));
}

function cleanComponents(value: unknown): Component[] {
  if (!Array.isArray(value)) return [];
  const detected = new Map<string, number>();
  for (const item of value) {
    const raw = item as { code?: unknown; quantity?: unknown };
    const code = normalize(raw.code);
    const quantity = Number(raw.quantity);
    if (code && Number.isInteger(quantity) && quantity > 0) detected.set(code, (detected.get(code) ?? 0) + quantity);
  }
  return Array.from(detected, ([code, quantity]) => ({ code, quantity }));
}

function components(title: string, localProducts: Map<string, number>, configured?: Component[]): ComponentSummary {
  const items = configured?.length ? cleanComponents(configured) : parseComponents(title);
  const unresolved = items.filter((item) => !localProducts.has(item.code)).map((item) => item.code);
  return {
    items,
    count: items.length,
    unresolved,
    status: items.length > 0 && unresolved.length === 0 ? "LISTO" as const : "REVISAR" as const,
    manual: Boolean(configured?.length),
  };
}

async function fetchExternalSupabaseSource() {
  const api = externalSupabaseClient();
  const latest = await api.from(TABLE).select("sync_run_id, imported_at").not("sync_run_id", "is", null).order("imported_at", { ascending: false }).limit(1).maybeSingle();
  if (latest.error || latest.data?.sync_run_id === null || latest.data?.sync_run_id === undefined) {
    throw new AppError("No se pudo encontrar una sincronizacion disponible en el catalogo externo.", 502);
  }
  const rows: RawRow[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
    const page = await api.from(TABLE)
      .select("id, sync_run_id, imported_at, codigo_interno, codigo_barras, stock, marca, titulo, tipo, payload")
      .eq("sync_run_id", latest.data.sync_run_id)
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (page.error) throw new AppError("No se pudo leer gesu_items_raw. Verifica el acceso de lectura del catalogo externo.", 502);
    const pageRows = (page.data ?? []) as RawRow[];
    rows.push(...pageRows);
    if (pageRows.length < PAGE_SIZE) return { rows, syncRunId: String(latest.data.sync_run_id), importedAt: latest.data.imported_at ?? null };
  }
  throw new AppError("La sincronizacion externa supera el limite permitido de 50.000 filas.", 422);
}

async function externalCatalogApiRequest(config: ExternalCatalogApiConfig, path: string, search: Record<string, string> = {}) {
  const url = new URL(`${config.baseUrl}/${path.replace(/^\/+/, "")}`);
  Object.entries(search).forEach(([key, value]) => url.searchParams.set(key, value));

  let response: Response;
  try {
    response = await fetch(url, {
      cache: "no-store",
      redirect: "error",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${config.token}`,
      },
      signal: AbortSignal.timeout(90_000),
    });
  } catch {
    throw new AppError("No se pudo conectar con la API del catalogo externo.", 502);
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = clean(payload(body).message);
    throw new AppError(message || `La API del catalogo externo respondio ${response.status}.`, 502);
  }
  return payload(body);
}

function apiRow(value: unknown, syncRunId: string, importedAt: string | null): RawRow {
  const data = payload(value);
  const stock = data.stock;
  return {
    id: clean(data.id) || clean(data.codigoInterno) || clean(data.codigo_interno),
    sync_run_id: syncRunId,
    imported_at: importedAt,
    codigo_interno: nullable(data.codigoInterno ?? data.codigo_interno),
    codigo_barras: nullable(data.codigoBarras ?? data.codigo_barras),
    stock: typeof stock === "string" || typeof stock === "number" ? stock : null,
    marca: nullable(data.marca),
    titulo: nullable(data.titulo),
    tipo: nullable(data.tipo),
    payload: data,
  };
}

async function fetchExternalApiSource(config: ExternalCatalogApiConfig) {
  const metadata = await externalCatalogApiRequest(config, "catalogo/resumen");
  const syncRunId = clean(metadata.syncRunId);
  const total = Number(metadata.total);
  const importedAt = nullable(metadata.updatedAt);

  if (!syncRunId || !Number.isInteger(total) || total < 0) {
    throw new AppError("La API del catalogo externo devolvio un resumen invalido.", 502);
  }
  if (total > MAX_ROWS) {
    throw new AppError("La sincronizacion externa supera el limite permitido de 50.000 filas.", 422);
  }

  const rows: RawRow[] = [];
  const cursors = new Set<string>();
  let cursor: string | null = null;

  do {
    const page = await externalCatalogApiRequest(config, "catalogo/items", {
      limit: String(PAGE_SIZE),
      syncRunId,
      ...(cursor ? { cursor } : {}),
    });
    const pageSyncRunId = clean(page.syncRunId);
    const pageTotal = Number(page.total);
    const items = page.items;

    if (pageSyncRunId !== syncRunId || !Number.isInteger(pageTotal) || pageTotal !== total || !Array.isArray(items) || items.length > PAGE_SIZE) {
      throw new AppError("La API del catalogo externo devolvio una pagina invalida.", 502);
    }
    rows.push(...items.map((item) => apiRow(item, syncRunId, importedAt)));

    const nextCursor = nullable(page.nextCursor);
    if (!nextCursor) {
      cursor = null;
      break;
    }
    if (cursors.has(nextCursor) || rows.length >= total) {
      throw new AppError("La API del catalogo externo devolvio una paginacion invalida.", 502);
    }
    cursors.add(nextCursor);
    cursor = nextCursor;
  } while (cursor);

  if (rows.length !== total) {
    throw new AppError("La API del catalogo externo no devolvio todos los registros de la sincronizacion.", 502);
  }
  return { rows, syncRunId, importedAt };
}

async function fetchSource() {
  const apiConfig = externalCatalogApiConfig();
  return apiConfig ? fetchExternalApiSource(apiConfig) : fetchExternalSupabaseSource();
}

async function existingCodes(table: "productos" | "kits", column: "cod_unico" | "codigo_kit", codes: string[]) {
  const map = new Map<string, number>();
  for (let offset = 0; offset < codes.length; offset += 5000) {
    const batch = codes.slice(offset, offset + 5000);
    if (!batch.length) continue;
    const result = await query<{ id: number; code: string }>(`SELECT id, UPPER(${column}) AS code FROM public.${table} WHERE UPPER(${column}) = ANY($1::text[])`, [batch]);
    result.rows.forEach((row) => map.set(normalize(row.code), Number(row.id)));
  }
  return map;
}

async function lookups() {
  const [subcategories, brands] = await Promise.all([
    query<{ id: number; categoria: string; subcategoria: string }>("SELECT s.id, c.descripcion AS categoria, s.descripcion AS subcategoria FROM public.subcategoria s JOIN public.categoria c ON c.id = s.id_categoria"),
    query<{ id: number; descripcion: string }>("SELECT id, descripcion FROM public.marcas"),
  ]);
  return {
    subcategories: new Map(subcategories.rows.map((row) => [`${normalize(row.categoria)}|${normalize(row.subcategoria)}`, Number(row.id)])),
    brands: new Map(brands.rows.map((row) => [normalize(row.descripcion), Number(row.id)])),
  };
}

async function manualClassifications(codes: string[]) {
  const result = new Map<string, ManualClassification>();
  for (let offset = 0; offset < codes.length; offset += 5000) {
    const batch = codes.slice(offset, offset + 5000);
    if (!batch.length) continue;
    const rows = await query<{ codigo_externo: string; id_subcategoria: number; categoria: string; subcategoria: string }>(
      `SELECT classification.codigo_externo, classification.id_subcategoria, category.descripcion AS categoria, subcategory.descripcion AS subcategoria
       FROM public.catalogo_externo_clasificacion classification
       JOIN public.subcategoria subcategory ON subcategory.id = classification.id_subcategoria
       JOIN public.categoria category ON category.id = subcategory.id_categoria
       WHERE classification.origen = $1 AND classification.codigo_externo = ANY($2::text[])`,
      [ORIGIN, batch]
    );
    rows.rows.forEach((row) => result.set(normalize(row.codigo_externo), {
      subcategoryId: Number(row.id_subcategoria), category: row.categoria, subcategory: row.subcategoria,
    }));
  }
  return result;
}

async function manualGroupComponents(codes: string[]) {
  const result = new Map<string, Component[]>();
  for (let offset = 0; offset < codes.length; offset += 5000) {
    const batch = codes.slice(offset, offset + 5000);
    if (!batch.length) continue;
    const rows = await query<{ codigo_kit: string; componentes: unknown }>(
      "SELECT codigo_kit, componentes FROM public.catalogo_externo_kit_componentes WHERE origen = $1 AND codigo_kit = ANY($2::text[])",
      [ORIGIN, batch]
    );
    rows.rows.forEach((row) => {
      const items = cleanComponents(row.componentes);
      if (items.length) result.set(normalize(row.codigo_kit), items);
    });
  }
  return result;
}

function stageRows(
  rows: RawRow[],
  catalog: Awaited<ReturnType<typeof lookups>>,
  products: Map<string, number>,
  groups: Map<string, number>,
  manual: Map<string, ManualClassification>,
  manualComponents: Map<string, Component[]>
) {
  const ignored = new Map<string, number>();
  const errors: string[] = [];
  let errorCount = 0;
  const accepted: Item[] = [];
  const codes = new Set<string>();

  for (const row of rows) {
    const item = parseRow(row);
    if (!item) {
      const data = payload(row.payload);
      const type = normalize(pick(data, ["tipo"]) || row.tipo) || "SIN_TIPO";
      ignored.set(type, (ignored.get(type) ?? 0) + 1);
      continue;
    }
    if (!item.code || codes.has(item.code)) {
      errorCount += 1;
      if (errors.length < SAMPLE_LIMIT) errors.push(item.code ? `${item.code}: codigo repetido en el catalogo externo.` : `Registro ${item.sourceId}: sin codigo interno.`);
      continue;
    }
    codes.add(item.code);
    accepted.push(item);
  }

  const items: Staged[] = accepted.map((item) => {
    const configured = manual.get(item.code);
    const category = configured?.category ?? item.category;
    const subcategory = configured?.subcategory ?? item.subcategory;
    const subcategoryId = configured?.subcategoryId ?? (category && subcategory ? catalog.subcategories.get(`${normalize(category)}|${normalize(subcategory)}`) ?? null : null);
    const status: Status = configured ? "LISTA" : !category || !subcategory ? "SIN_DATOS" : subcategoryId ? "LISTA" : "REVISAR";
    const exists = item.type === "PRODUCTO" ? products.has(item.code) : groups.has(item.code);
    return {
      ...item,
      category,
      subcategory,
      status,
      subcategoryId,
      brandId: catalog.brands.get(normalize(item.brand)) ?? null,
      exists,
      localProductId: item.type === "PRODUCTO" ? products.get(item.code) ?? null : null,
      components: item.type === "GRUPO"
        ? components(item.title || item.description, products, manualComponents.get(item.code) ?? item.sourceComponents)
        : { items: [], count: 0, unresolved: [], status: "REVISAR", manual: false },
    };
  });
  return {
    items,
    ignored: Array.from(ignored, ([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
    errors,
    errorCount,
  };
}

async function saveSnapshot(syncRunId: string, importedAt: string | null, sourceRows: number, staged: ReturnType<typeof stageRows>) {
  return withTransaction(async (db) => {
    // Evita que una consulta manual y el cron reemplacen la misma revision al mismo tiempo.
    await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`${ORIGIN}:snapshot`]);
    const header = await db.query<{ id: number }>(
      `INSERT INTO public.catalogo_externo_sincronizacion (origen, sync_run_id, fecha_origen, consultado_at, total_registros, ignorados, errores, error_count)
       VALUES ($1, $2, $3, NOW(), $4, $5::jsonb, $6::jsonb, $7)
       ON CONFLICT (origen, sync_run_id) DO UPDATE SET fecha_origen = EXCLUDED.fecha_origen, consultado_at = NOW(), total_registros = EXCLUDED.total_registros, ignorados = EXCLUDED.ignorados, errores = EXCLUDED.errores, error_count = EXCLUDED.error_count
       RETURNING id`,
      [ORIGIN, syncRunId, importedAt, sourceRows, JSON.stringify(staged.ignored), JSON.stringify(staged.errors), staged.errorCount]
    );
    const snapshotId = Number(header.rows[0].id);
    await db.query("DELETE FROM public.catalogo_externo_item WHERE id_sincronizacion = $1", [snapshotId]);

    for (let offset = 0; offset < staged.items.length; offset += PAGE_SIZE) {
      const batch = staged.items.slice(offset, offset + PAGE_SIZE);
      await db.query(
        `INSERT INTO public.catalogo_externo_item (
          id_sincronizacion, external_id, source_row_id, tipo, codigo, titulo, descripcion, marca, categoria, subcategoria,
          codigo_barras, palabras_clave, stock, ubicacion, proveedor, codigo_proveedor,
          estado_clasificacion, id_subcategoria, id_marca, existe_local, id_producto_local, componentes
        ) SELECT datos.id_sincronizacion, datos.external_id, datos.source_row_id, datos.tipo, datos.codigo, datos.titulo, datos.descripcion,
          datos.marca, datos.categoria, datos.subcategoria, datos.codigo_barras, datos.palabras_clave,
          datos.stock, datos.ubicacion, datos.proveedor, datos.codigo_proveedor, datos.estado_clasificacion,
          datos.id_subcategoria, datos.id_marca, datos.existe_local, datos.id_producto_local, datos.componentes::jsonb
        FROM UNNEST(
          $1::integer[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::text[], $9::text[], $10::text[],
          $11::text[], $12::text[], $13::integer[], $14::text[], $15::text[], $16::text[], $17::text[], $18::integer[], $19::integer[],
          $20::boolean[], $21::integer[], $22::text[]
        ) AS datos(
          id_sincronizacion, external_id, source_row_id, tipo, codigo, titulo, descripcion, marca, categoria, subcategoria,
          codigo_barras, palabras_clave, stock, ubicacion, proveedor, codigo_proveedor,
          estado_clasificacion, id_subcategoria, id_marca, existe_local, id_producto_local, componentes
        )`,
        [
          batch.map(() => snapshotId), batch.map((item) => item.sourceId), batch.map((item) => item.sourceId), batch.map((item) => item.type),
          batch.map((item) => item.code), batch.map((item) => item.title || item.description), batch.map((item) => item.description || item.code),
          batch.map((item) => nullable(item.brand)), batch.map((item) => nullable(item.category)), batch.map((item) => nullable(item.subcategory)),
          batch.map((item) => nullable(item.barcode)), batch.map((item) => nullable(item.keywords)), batch.map((item) => item.stock),
          batch.map((item) => nullable(item.location)), batch.map((item) => nullable(item.provider)), batch.map((item) => nullable(item.providerCode)),
          batch.map((item) => item.status), batch.map((item) => item.subcategoryId), batch.map((item) => item.brandId), batch.map((item) => item.exists),
          batch.map((item) => item.localProductId), batch.map((item) => JSON.stringify(item.components)),
        ]
      );
    }
    return snapshotId;
  });
}

const ignoredFrom = (value: unknown) => Array.isArray(value)
  ? value.map((item) => ({ type: clean((item as { type?: unknown })?.type), count: Number((item as { count?: unknown })?.count) || 0 })).filter((item) => item.type && item.count > 0)
  : [];
const errorsFrom = (value: unknown) => Array.isArray(value) ? value.map(clean).filter(Boolean).slice(0, SAMPLE_LIMIT) : [];
const toProduct = (row: StagedProduct): CatalogProduct => ({
  id: Number(row.id), code: row.codigo, description: row.descripcion, brand: row.marca ?? "", category: row.categoria ?? "", subcategory: row.subcategoria ?? "",
  stock: Number(row.stock ?? 0), location: row.ubicacion ?? "", provider: row.proveedor ?? "", providerCode: row.codigo_proveedor ?? "",
  classification: row.estado_clasificacion, brandIsNew: Boolean(row.marca && !row.id_marca),
});
const toGroup = (row: { id: number; codigo: string; descripcion: string; categoria: string | null; subcategoria: string | null; componentes: ComponentSummary }): CatalogGroup => ({
  id: Number(row.id),
  code: row.codigo,
  description: row.descripcion,
  category: row.categoria ?? "",
  subcategory: row.subcategoria ?? "",
  componentsDetail: cleanComponents(row.componentes?.items),
  components: Number(row.componentes?.count ?? 0),
  unresolvedComponents: Array.isArray(row.componentes?.unresolved) ? row.componentes.unresolved : [],
  status: row.componentes?.status === "LISTO" ? "LISTO" : "REVISAR",
  hasManualComponents: Boolean(row.componentes?.manual),
});

async function summary(snapshotId: number): Promise<ExternalCatalogPreview> {
  const [headerResult, totalsResult, productRows, groupRows] = await Promise.all([
    query<Snapshot>("SELECT id, sync_run_id, fecha_origen, total_registros, ignorados, errores, error_count FROM public.catalogo_externo_sincronizacion WHERE id = $1", [snapshotId]),
    query<{ pt: number; pe: number; pn: number; pl: number; gt: number; ge: number; gn: number; gl: number }>(
      `SELECT COUNT(*) FILTER (WHERE tipo = 'PRODUCTO')::int AS pt, COUNT(*) FILTER (WHERE tipo = 'PRODUCTO' AND existe_local)::int AS pe,
        COUNT(*) FILTER (WHERE tipo = 'PRODUCTO' AND NOT existe_local)::int AS pn, COUNT(*) FILTER (WHERE tipo = 'PRODUCTO' AND NOT existe_local AND estado_clasificacion = 'LISTA')::int AS pl,
        COUNT(*) FILTER (WHERE tipo = 'GRUPO')::int AS gt, COUNT(*) FILTER (WHERE tipo = 'GRUPO' AND existe_local)::int AS ge,
        COUNT(*) FILTER (WHERE tipo = 'GRUPO' AND NOT existe_local)::int AS gn, COUNT(*) FILTER (WHERE tipo = 'GRUPO' AND NOT existe_local AND componentes->>'status' = 'LISTO')::int AS gl
       FROM public.catalogo_externo_item WHERE id_sincronizacion = $1`, [snapshotId]),
    query<StagedProduct>("SELECT id, external_id, codigo, descripcion, marca, categoria, subcategoria, codigo_barras, palabras_clave, stock, ubicacion, proveedor, codigo_proveedor, estado_clasificacion, id_marca, id_subcategoria FROM public.catalogo_externo_item WHERE id_sincronizacion = $1 AND tipo = 'PRODUCTO' AND NOT existe_local AND estado_clasificacion <> 'LISTA' ORDER BY codigo LIMIT $2", [snapshotId, SAMPLE_LIMIT]),
    query<{ id: number; codigo: string; descripcion: string; categoria: string | null; subcategoria: string | null; componentes: ComponentSummary }>("SELECT id, codigo, descripcion, categoria, subcategoria, componentes FROM public.catalogo_externo_item WHERE id_sincronizacion = $1 AND tipo = 'GRUPO' AND NOT existe_local AND componentes->>'status' <> 'LISTO' ORDER BY codigo LIMIT $2", [snapshotId, SAMPLE_LIMIT]),
  ]);
  const header = headerResult.rows[0];
  if (!header) throw new AppError("No se encontro la revision externa solicitada.", 404);
  const count = totalsResult.rows[0] ?? { pt: 0, pe: 0, pn: 0, pl: 0, gt: 0, ge: 0, gn: 0, gl: 0 };
  return {
    snapshotId, syncRunId: header.sync_run_id, importedAt: header.fecha_origen, sourceRows: Number(header.total_registros),
    products: { total: Number(count.pt), existing: Number(count.pe), new: Number(count.pn), classificationReady: Number(count.pl), classificationPending: Number(count.pn) - Number(count.pl) },
    groups: { total: Number(count.gt), existing: Number(count.ge), new: Number(count.gn), ready: Number(count.gl), review: Number(count.gn) - Number(count.gl) },
    ignored: ignoredFrom(header.ignorados), errors: errorsFrom(header.errores), errorCount: Number(header.error_count),
    productsToReview: productRows.rows.map(toProduct),
    groupsToReview: groupRows.rows.map(toGroup),
  };
}

export async function refreshExternalCatalogPreview() {
  const source = await fetchSource();
  const sourceItems = source.rows.map(parseRow).filter((item): item is Item => Boolean(item));
  const productCodes = sourceItems.filter((item) => item.type === "PRODUCTO").map((item) => item.code).filter(Boolean);
  const groupCodes = sourceItems.filter((item) => item.type === "GRUPO").map((item) => item.code).filter(Boolean);
  const componentCodes = sourceItems
    .filter((item) => item.type === "GRUPO")
    .flatMap((item) => parseComponents(item.title || item.description).map((component) => component.code));
  const [catalog, products, groups, manual, configuredComponents] = await Promise.all([
    lookups(),
    existingCodes("productos", "cod_unico", Array.from(new Set([...productCodes, ...componentCodes]))),
    existingCodes("kits", "codigo_kit", groupCodes),
    manualClassifications(sourceItems.map((item) => item.code).filter(Boolean)),
    manualGroupComponents(groupCodes),
  ]);
  const snapshotId = await saveSnapshot(source.syncRunId, source.importedAt, source.rows.length, stageRows(source.rows, catalog, products, groups, manual, configuredComponents));
  return summary(snapshotId);
}

export async function getExternalCatalogProducts(snapshotId: number, page: number, limit: number, search?: string, status?: Status): Promise<CatalogProductsPage> {
  const safeLimit = Math.max(10, Math.min(100, Math.floor(limit)));
  const params: unknown[] = [snapshotId];
  const where = ["id_sincronizacion = $1", "tipo = 'PRODUCTO'", "existe_local = FALSE"];
  if (status) { params.push(status); where.push(`estado_clasificacion = $${params.length}`); }
  if (search?.trim()) { params.push(`%${search.trim()}%`); where.push(`(codigo ILIKE $${params.length} OR descripcion ILIKE $${params.length} OR marca ILIKE $${params.length})`); }
  const condition = where.join(" AND ");
  const count = await query<{ total: number }>(`SELECT COUNT(*)::int AS total FROM public.catalogo_externo_item WHERE ${condition}`, params);
  const totalCount = Number(count.rows[0]?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / safeLimit));
  const currentPage = Math.min(Math.max(1, Math.floor(page)), totalPages);
  const rows = await query<StagedProduct>(
    `SELECT id, external_id, codigo, descripcion, marca, categoria, subcategoria, codigo_barras, palabras_clave, stock, ubicacion, proveedor, codigo_proveedor, estado_clasificacion, id_marca, id_subcategoria
     FROM public.catalogo_externo_item WHERE ${condition}
     ORDER BY CASE estado_clasificacion WHEN 'LISTA' THEN 0 WHEN 'REVISAR' THEN 1 ELSE 2 END, codigo ASC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, safeLimit, (currentPage - 1) * safeLimit]
  );
  return { data: rows.rows.map(toProduct), page: currentPage, totalPages, totalCount };
}

type StagedGroup = {
  id: number;
  external_id: string;
  codigo: string;
  descripcion: string;
  categoria: string | null;
  subcategoria: string | null;
  id_subcategoria: number | null;
  componentes: ComponentSummary;
};

export async function getExternalCatalogGroups(snapshotId: number, page: number, limit: number, search?: string, status?: "LISTO" | "REVISAR"): Promise<CatalogGroupsPage> {
  const safeLimit = Math.max(10, Math.min(100, Math.floor(limit)));
  const params: unknown[] = [snapshotId];
  const where = ["id_sincronizacion = $1", "tipo = 'GRUPO'", "existe_local = FALSE"];
  if (status) { params.push(status); where.push(`componentes->>'status' = $${params.length}`); }
  if (search?.trim()) { params.push(`%${search.trim()}%`); where.push(`(codigo ILIKE $${params.length} OR descripcion ILIKE $${params.length})`); }
  const condition = where.join(" AND ");
  const count = await query<{ total: number }>(`SELECT COUNT(*)::int AS total FROM public.catalogo_externo_item WHERE ${condition}`, params);
  const totalCount = Number(count.rows[0]?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / safeLimit));
  const currentPage = Math.min(Math.max(1, Math.floor(page)), totalPages);
  const rows = await query<StagedGroup>(
    `SELECT id, external_id, codigo, descripcion, categoria, subcategoria, id_subcategoria, componentes
     FROM public.catalogo_externo_item WHERE ${condition}
     ORDER BY CASE componentes->>'status' WHEN 'LISTO' THEN 0 ELSE 1 END, codigo ASC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, safeLimit, (currentPage - 1) * safeLimit]
  );
  return { data: rows.rows.map(toGroup), page: currentPage, totalPages, totalCount };
}

export async function saveExternalCatalogGroupComponents(snapshotId: number, itemId: number, rawComponents: unknown[], userId: number) {
  const configured = cleanComponents(rawComponents);
  if (!configured.length) throw new AppError("El kit debe tener al menos un componente valido.", 400);

  const group = await withTransaction(async (db) => {
    const selected = await db.query<{ codigo: string }>(
      `SELECT codigo FROM public.catalogo_externo_item
       WHERE id = $1 AND id_sincronizacion = $2 AND tipo = 'GRUPO' AND existe_local = FALSE
       FOR UPDATE`,
      [itemId, snapshotId]
    );
    if (!selected.rows[0]) throw new AppError("El grupo externo ya no esta disponible para editar.", 404);

    const products = await db.query<{ id: number; cod_unico: string }>(
      "SELECT id, cod_unico FROM public.productos WHERE UPPER(cod_unico) = ANY($1::text[])",
      [configured.map((component) => component.code)]
    );
    const localProducts = new Map(products.rows.map((row) => [normalize(row.cod_unico), Number(row.id)]));
    const missing = configured.filter((component) => !localProducts.has(component.code)).map((component) => component.code);
    if (missing.length) throw new AppError(`No se encontraron estos componentes: ${missing.join(", ")}.`, 400);

    const detail: ComponentSummary = components("", localProducts, configured);
    await db.query(
      `INSERT INTO public.catalogo_externo_kit_componentes (origen, codigo_kit, componentes, usuario_id, updated_at)
       VALUES ($1, $2, $3::jsonb, $4, NOW())
       ON CONFLICT (origen, codigo_kit) DO UPDATE
         SET componentes = EXCLUDED.componentes, usuario_id = EXCLUDED.usuario_id, updated_at = NOW()`,
      [ORIGIN, selected.rows[0].codigo, JSON.stringify(configured), userId]
    );
    const updated = await db.query<StagedGroup>(
      `UPDATE public.catalogo_externo_item
       SET componentes = $3::jsonb
       WHERE id = $1 AND id_sincronizacion = $2
       RETURNING id, external_id, codigo, descripcion, categoria, subcategoria, id_subcategoria, componentes`,
      [itemId, snapshotId, JSON.stringify(detail)]
    );
    return toGroup(updated.rows[0]);
  });
  return { group, preview: await summary(snapshotId) };
}

export async function classifyExternalCatalogProduct(
  snapshotId: number,
  itemId: number,
  categoryId: number,
  subcategoryId: number,
  userId: number
) {
  const product = await withTransaction(async (db) => {
    const item = await db.query<{ codigo: string }>(
      `SELECT codigo FROM public.catalogo_externo_item
       WHERE id = $1 AND id_sincronizacion = $2 AND tipo = 'PRODUCTO' AND existe_local = FALSE
       FOR UPDATE`,
      [itemId, snapshotId]
    );
    if (!item.rows[0]) throw new AppError("El producto externo ya no esta disponible para clasificar.", 404);

    const classification = await db.query<{ categoria: string; subcategoria: string }>(
      `SELECT category.descripcion AS categoria, subcategory.descripcion AS subcategoria
       FROM public.subcategoria subcategory
       JOIN public.categoria category ON category.id = subcategory.id_categoria
       WHERE subcategory.id = $1 AND category.id = $2`,
      [subcategoryId, categoryId]
    );
    if (!classification.rows[0]) throw new AppError("La subcategoria no pertenece a la categoria elegida.", 400);

    await db.query(
      `INSERT INTO public.catalogo_externo_clasificacion (origen, codigo_externo, id_subcategoria, usuario_id, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (origen, codigo_externo) DO UPDATE
         SET id_subcategoria = EXCLUDED.id_subcategoria, usuario_id = EXCLUDED.usuario_id, updated_at = NOW()`,
      [ORIGIN, item.rows[0].codigo, subcategoryId, userId]
    );

    const updated = await db.query<StagedProduct>(
      `UPDATE public.catalogo_externo_item
       SET categoria = $3, subcategoria = $4, id_subcategoria = $5, estado_clasificacion = 'LISTA'
       WHERE id = $1 AND id_sincronizacion = $2
       RETURNING id, external_id, codigo, descripcion, marca, categoria, subcategoria, codigo_barras, palabras_clave,
         stock, ubicacion, proveedor, codigo_proveedor, estado_clasificacion, id_marca, id_subcategoria`,
      [itemId, snapshotId, classification.rows[0].categoria, classification.rows[0].subcategoria, subcategoryId]
    );
    return toProduct(updated.rows[0]);
  });

  return { product, preview: await summary(snapshotId) };
}

const barcodeIsValid = (value: string | null) => Boolean(value && /^\d+$/.test(value));

export async function importExternalCatalogProducts(snapshotId: number, rawIds: unknown[], userId: number): Promise<CatalogImportResponse> {
  const ids = Array.from(new Set(rawIds.map(Number).filter((id) => Number.isInteger(id) && id > 0)));
  if (!ids.length) throw new AppError("Selecciona al menos un producto listo para importar.", 400);
  if (ids.length > IMPORT_LIMIT) throw new AppError(`La importacion admite hasta ${IMPORT_LIMIT} productos por vez.`, 400);

  const result = await withTransaction(async (db) => {
    const selected = await db.query<StagedProduct>(
      `SELECT id, external_id, codigo, descripcion, marca, categoria, subcategoria, codigo_barras, palabras_clave, stock, ubicacion, proveedor, codigo_proveedor, estado_clasificacion, id_marca, id_subcategoria
       FROM public.catalogo_externo_item WHERE id_sincronizacion = $1 AND id = ANY($2::integer[]) AND tipo = 'PRODUCTO'
         AND existe_local = FALSE AND estado_clasificacion = 'LISTA' AND id_subcategoria IS NOT NULL FOR UPDATE`, [snapshotId, ids]);
    const invalidSelection = ids.length - selected.rows.length;
    if (!selected.rows.length) throw new AppError("Los productos seleccionados ya no estan disponibles para importar.", 409);

    const local = await db.query<{ id: number; cod_unico: string }>("SELECT id, cod_unico FROM public.productos WHERE UPPER(cod_unico) = ANY($1::text[])", [selected.rows.map((row) => normalize(row.codigo))]);
    const localByCode = new Map(local.rows.map((row) => [normalize(row.cod_unico), Number(row.id)]));
    const candidates = selected.rows.filter((row) => !localByCode.has(normalize(row.codigo)));
    const skippedExisting = selected.rows.length - candidates.length;
    const conflicting = selected.rows.filter((row) => localByCode.has(normalize(row.codigo)));
    if (conflicting.length) await db.query(
      "UPDATE public.catalogo_externo_item AS item SET existe_local = TRUE, id_producto_local = data.id_producto FROM UNNEST($1::integer[], $2::integer[]) AS data(id, id_producto) WHERE item.id = data.id",
      [conflicting.map((row) => row.id), conflicting.map((row) => localByCode.get(normalize(row.codigo)) ?? 0)]
    );
    if (!candidates.length) {
      return {
        created: 0, skippedExisting, invalidSelection, brandsCreated: 0, providersCreated: 0,
        providersLinked: 0, locationsCreated: 0, stockImported: 0, ignoredBarcodes: 0,
      };
    }

    const currentBrands = await db.query<{ id: number; descripcion: string }>("SELECT id, descripcion FROM public.marcas");
    const brandByName = new Map(currentBrands.rows.map((row) => [normalize(row.descripcion), Number(row.id)]));
    let brandsCreated = 0;
    for (const brand of Array.from(new Set(candidates.map((row) => clean(row.marca)).filter(Boolean)))) {
      const key = normalize(brand);
      if (brandByName.has(key)) continue;
      const inserted = await db.query<{ id: number }>("INSERT INTO public.marcas (descripcion) SELECT $1 WHERE NOT EXISTS (SELECT 1 FROM public.marcas WHERE UPPER(TRIM(descripcion)) = UPPER(TRIM($1))) RETURNING id", [brand]);
      if (inserted.rows[0]) { brandByName.set(key, Number(inserted.rows[0].id)); brandsCreated += 1; }
      else {
        const existingBrand = await db.query<{ id: number }>("SELECT id FROM public.marcas WHERE UPPER(TRIM(descripcion)) = UPPER(TRIM($1)) LIMIT 1", [brand]);
        if (existingBrand.rows[0]) brandByName.set(key, Number(existingBrand.rows[0].id));
      }
    }

    const currentProviders = await db.query<{ id: number; descripcion: string }>("SELECT id, descripcion FROM public.proveedores");
    const providerByName = new Map(currentProviders.rows.map((row) => [normalize(row.descripcion), Number(row.id)]));
    let providersCreated = 0;
    for (const provider of Array.from(new Set(candidates.map((row) => clean(row.proveedor)).filter(Boolean)))) {
      const key = normalize(provider);
      if (providerByName.has(key)) continue;
      const insertedProvider = await db.query<{ id: number }>(
        "INSERT INTO public.proveedores (descripcion) SELECT $1 WHERE NOT EXISTS (SELECT 1 FROM public.proveedores WHERE UPPER(TRIM(descripcion)) = UPPER(TRIM($1))) RETURNING id",
        [provider]
      );
      if (insertedProvider.rows[0]) {
        providerByName.set(key, Number(insertedProvider.rows[0].id));
        providersCreated += 1;
      } else {
        const existingProvider = await db.query<{ id: number }>("SELECT id FROM public.proveedores WHERE UPPER(TRIM(descripcion)) = UPPER(TRIM($1)) LIMIT 1", [provider]);
        if (existingProvider.rows[0]) providerByName.set(key, Number(existingProvider.rows[0].id));
      }
    }

    const currentLocations = await db.query<{ id: number; descripcion: string }>("SELECT id, descripcion FROM public.ubicaciones");
    const locationByName = new Map(currentLocations.rows.map((row) => [normalize(row.descripcion), Number(row.id)]));
    let locationsCreated = 0;
    const resolveLocation = async (row: StagedProduct) => {
      const description = clean(row.ubicacion);
      if (!description && Number(row.stock) <= 0) return null;
      const name = description || "SIN UBICACION";
      const key = normalize(name);
      const known = locationByName.get(key);
      if (known) return known;
      const insertedLocation = await db.query<{ id: number }>(
        "INSERT INTO public.ubicaciones (descripcion) VALUES ($1) ON CONFLICT (descripcion) DO UPDATE SET descripcion = EXCLUDED.descripcion RETURNING id",
        [name]
      );
      const id = Number(insertedLocation.rows[0].id);
      locationByName.set(key, id);
      if (name !== "SIN UBICACION") locationsCreated += 1;
      return id;
    };
    const locationIds = await Promise.all(candidates.map(resolveLocation));

    const requestedBarcodes = candidates.map((row) => nullable(row.codigo_barras)).filter(barcodeIsValid) as string[];
    const barcodeResult = requestedBarcodes.length ? await db.query<{ cod_barra: string }>("SELECT cod_barra FROM public.productos WHERE cod_barra = ANY($1::text[])", [requestedBarcodes]) : { rows: [] as { cod_barra: string }[] };
    const usedBarcodes = new Set(barcodeResult.rows.map((row) => row.cod_barra));
    let ignoredBarcodes = 0;
    const barcodes = candidates.map((row) => {
      const barcode = nullable(row.codigo_barras);
      if (!barcode || !barcodeIsValid(barcode) || usedBarcodes.has(barcode)) { if (barcode) ignoredBarcodes += 1; return null; }
      usedBarcodes.add(barcode);
      return barcode;
    });

    const inserted = await db.query<{ id: number; cod_unico: string }>(
      `INSERT INTO public.productos (cod_unico, descripcion, cod_barra, stock, id_marca, id_subcategoria, palabra_clave, criterio_costo, id_ubicacion)
       SELECT * FROM UNNEST($1::text[], $2::text[], $3::text[], $4::integer[], $5::integer[], $6::integer[], $7::text[], $8::text[], $9::integer[])
         AS data(cod_unico, descripcion, cod_barra, stock, id_marca, id_subcategoria, palabra_clave, criterio_costo, id_ubicacion)
       ON CONFLICT (cod_unico) DO NOTHING RETURNING id, cod_unico`,
      [
        candidates.map((row) => normalize(row.codigo)), candidates.map((row) => clean(row.descripcion) || normalize(row.codigo)), barcodes,
        candidates.map((row) => stockValue(row.stock)), candidates.map((row) => clean(row.marca) ? brandByName.get(normalize(row.marca)) ?? null : null),
        candidates.map((row) => Number(row.id_subcategoria)), candidates.map((row) => nullable(row.palabras_clave)), candidates.map(() => "PROVEEDOR_UNICO"), locationIds,
      ]
    );
    const createdByCode = new Map(inserted.rows.map((row) => [normalize(row.cod_unico), Number(row.id)]));
    const created = candidates.filter((row) => createdByCode.has(normalize(row.codigo)));
    const locationByCode = new Map(candidates.map((row, index) => [normalize(row.codigo), locationIds[index]]));
    let providersLinked = 0;
    const stockImported = created.reduce((total, row) => total + stockValue(row.stock), 0);
    if (created.length) {
      const locationRows = created
        .map((row) => ({ idProducto: createdByCode.get(normalize(row.codigo)) ?? 0, idUbicacion: locationByCode.get(normalize(row.codigo)), stock: stockValue(row.stock) }))
        .filter((row): row is { idProducto: number; idUbicacion: number; stock: number } => Boolean(row.idUbicacion));
      if (locationRows.length) {
        await db.query(
          `INSERT INTO public.producto_stock_ubicacion (id_producto, id_ubicacion, cantidad)
           SELECT * FROM UNNEST($1::integer[], $2::integer[], $3::integer[])
             AS data(id_producto, id_ubicacion, cantidad)
           ON CONFLICT (id_producto, id_ubicacion) DO UPDATE SET cantidad = EXCLUDED.cantidad`,
          [locationRows.map((row) => row.idProducto), locationRows.map((row) => row.idUbicacion), locationRows.map((row) => row.stock)]
        );
      }

      const providerRows = created
        .map((row) => ({
          idProducto: createdByCode.get(normalize(row.codigo)) ?? 0,
          idProveedor: providerByName.get(normalize(row.proveedor)),
          codigoProveedor: nullable(row.codigo_proveedor),
        }))
        .filter((row): row is { idProducto: number; idProveedor: number; codigoProveedor: string | null } => Boolean(row.idProveedor));
      if (providerRows.length) {
        await db.query(
          `INSERT INTO public.producto_proveedor (id_producto, id_proveedor, codigo_proveedor)
           SELECT * FROM UNNEST($1::integer[], $2::integer[], $3::text[])
             AS data(id_producto, id_proveedor, codigo_proveedor)
           ON CONFLICT (id_producto, id_proveedor) DO UPDATE
             SET codigo_proveedor = COALESCE(NULLIF(EXCLUDED.codigo_proveedor, ''), producto_proveedor.codigo_proveedor)`,
          [providerRows.map((row) => row.idProducto), providerRows.map((row) => row.idProveedor), providerRows.map((row) => row.codigoProveedor)]
        );
        providersLinked = providerRows.length;
      }

      await db.query(
        "UPDATE public.catalogo_externo_item AS item SET existe_local = TRUE, id_producto_local = data.id_producto FROM UNNEST($1::integer[], $2::integer[]) AS data(id, id_producto) WHERE item.id = data.id",
        [created.map((row) => row.id), created.map((row) => createdByCode.get(normalize(row.codigo)) ?? 0)]
      );
      await db.query(
        `INSERT INTO public.producto_origen_externo (id_producto, origen, external_id, codigo_externo, sync_run_id, fecha_sincronizacion)
         SELECT data.id_producto, $1, data.external_id, data.codigo, snapshot.sync_run_id, NOW()
         FROM UNNEST($2::integer[], $3::text[], $4::text[]) AS data(id_producto, external_id, codigo)
         JOIN public.catalogo_externo_sincronizacion snapshot ON snapshot.id = $5
         ON CONFLICT (origen, external_id) DO UPDATE SET id_producto = EXCLUDED.id_producto, codigo_externo = EXCLUDED.codigo_externo, sync_run_id = EXCLUDED.sync_run_id, fecha_sincronizacion = EXCLUDED.fecha_sincronizacion`,
        [ORIGIN, created.map((row) => createdByCode.get(normalize(row.codigo)) ?? 0), created.map((row) => row.external_id), created.map((row) => normalize(row.codigo)), snapshotId]
      );
      await db.query(
        `INSERT INTO public.producto_actividad (id_producto, codigo_producto, tipo, titulo, detalle, datos, usuario_id)
         SELECT data.id_producto, data.codigo, 'ALTA', 'Item importado desde catalogo externo', data.detalle,
           jsonb_build_object('origen', $1::text, 'snapshotId', $2::integer), $3::integer
         FROM UNNEST($4::integer[], $5::text[], $6::text[]) AS data(id_producto, codigo, detalle)`,
        [ORIGIN, snapshotId, userId, created.map((row) => createdByCode.get(normalize(row.codigo)) ?? 0), created.map((row) => normalize(row.codigo)), created.map((row) => clean(row.descripcion))]
      );
    }
    return {
      created: created.length, skippedExisting, invalidSelection, brandsCreated, providersCreated,
      providersLinked, locationsCreated, stockImported, ignoredBarcodes,
    };
  });
  revalidateTag("meta");
  return { ...result, preview: await summary(snapshotId) };
}

export async function importExternalCatalogGroups(snapshotId: number, rawIds: unknown[]): Promise<CatalogGroupImportResult> {
  const ids = Array.from(new Set(rawIds.map(Number).filter((id) => Number.isInteger(id) && id > 0)));
  if (!ids.length) throw new AppError("Selecciona al menos un kit listo para importar.", 400);
  if (ids.length > IMPORT_LIMIT) throw new AppError(`La importacion admite hasta ${IMPORT_LIMIT} kits por vez.`, 400);

  const result = await withTransaction(async (db) => {
    const selected = await db.query<StagedGroup>(
      `SELECT id, external_id, codigo, descripcion, categoria, subcategoria, id_subcategoria, componentes
       FROM public.catalogo_externo_item
       WHERE id_sincronizacion = $1 AND id = ANY($2::integer[]) AND tipo = 'GRUPO'
         AND existe_local = FALSE AND componentes->>'status' = 'LISTO'
       FOR UPDATE`,
      [snapshotId, ids]
    );
    const invalidSelection = ids.length - selected.rows.length;
    if (!selected.rows.length) throw new AppError("Los kits seleccionados ya no estan listos para importar.", 409);

    const existing = await db.query<{ id: number; codigo_kit: string }>(
      "SELECT id, codigo_kit FROM public.kits WHERE UPPER(codigo_kit) = ANY($1::text[])",
      [selected.rows.map((row) => normalize(row.codigo))]
    );
    const existingByCode = new Map(existing.rows.map((row) => [normalize(row.codigo_kit), Number(row.id)]));
    const candidates = selected.rows.filter((row) => !existingByCode.has(normalize(row.codigo)));
    const skippedExisting = selected.rows.length - candidates.length;
    const conflicts = selected.rows.filter((row) => existingByCode.has(normalize(row.codigo)));
    if (conflicts.length) {
      await db.query(
        "UPDATE public.catalogo_externo_item AS item SET existe_local = TRUE FROM UNNEST($1::integer[]) AS data(id) WHERE item.id = data.id",
        [conflicts.map((row) => row.id)]
      );
    }
    if (!candidates.length) return { created: 0, skippedExisting, invalidSelection, componentsLinked: 0 };

    const componentCodes = Array.from(new Set(candidates.flatMap((group) => cleanComponents(group.componentes?.items).map((component) => component.code))));
    const products = await db.query<{ id: number; cod_unico: string }>(
      "SELECT id, cod_unico FROM public.productos WHERE UPPER(cod_unico) = ANY($1::text[])",
      [componentCodes]
    );
    const productByCode = new Map(products.rows.map((row) => [normalize(row.cod_unico), Number(row.id)]));
    const importable = candidates.filter((group) => cleanComponents(group.componentes?.items).every((component) => productByCode.has(component.code)));
    const unavailable = candidates.filter((group) => !importable.includes(group));
    if (unavailable.length) {
      await db.query(
        "UPDATE public.catalogo_externo_item SET componentes = jsonb_set(componentes, '{status}', '\"REVISAR\"'::jsonb) WHERE id = ANY($1::integer[])",
        [unavailable.map((group) => group.id)]
      );
    }
    if (!importable.length) return { created: 0, skippedExisting, invalidSelection: invalidSelection + unavailable.length, componentsLinked: 0 };

    const inserted = await db.query<{ id: number; codigo_kit: string }>(
      `INSERT INTO public.kits (codigo_kit, nombre, descripcion, id_subcategoria, activo)
       SELECT * FROM UNNEST($1::text[], $2::text[], $3::text[], $4::integer[], $5::boolean[])
         AS data(codigo_kit, nombre, descripcion, id_subcategoria, activo)
       ON CONFLICT (codigo_kit) DO NOTHING
       RETURNING id, codigo_kit`,
      [
        importable.map((group) => normalize(group.codigo)),
        importable.map((group) => clean(group.descripcion) || normalize(group.codigo)),
        importable.map(() => null), importable.map((group) => group.id_subcategoria), importable.map(() => true),
      ]
    );
    const kitByCode = new Map(inserted.rows.map((row) => [normalize(row.codigo_kit), Number(row.id)]));
    const created = importable.filter((group) => kitByCode.has(normalize(group.codigo)));
    if (!created.length) return { created: 0, skippedExisting, invalidSelection, componentsLinked: 0 };

    const detailRows = created.flatMap((group) => cleanComponents(group.componentes?.items).map((component) => ({
      idKit: kitByCode.get(normalize(group.codigo)) ?? 0,
      idProduct: productByCode.get(component.code) ?? 0,
      quantity: component.quantity,
    })));
    if (detailRows.length) {
      await db.query(
        `INSERT INTO public.kit_detalle (id_kit, id_producto, cantidad)
         SELECT * FROM UNNEST($1::integer[], $2::integer[], $3::numeric[])
           AS data(id_kit, id_producto, cantidad)`,
        [detailRows.map((row) => row.idKit), detailRows.map((row) => row.idProduct), detailRows.map((row) => row.quantity)]
      );
    }
    await db.query(
      "UPDATE public.catalogo_externo_item AS item SET existe_local = TRUE FROM UNNEST($1::integer[]) AS data(id) WHERE item.id = data.id",
      [created.map((group) => group.id)]
    );
    await db.query(
      `INSERT INTO public.kit_origen_externo (id_kit, origen, external_id, codigo_externo, sync_run_id, fecha_sincronizacion)
       SELECT data.id_kit, $1, data.external_id, data.codigo, snapshot.sync_run_id, NOW()
       FROM UNNEST($2::integer[], $3::text[], $4::text[]) AS data(id_kit, external_id, codigo)
       JOIN public.catalogo_externo_sincronizacion snapshot ON snapshot.id = $5
       ON CONFLICT (origen, external_id) DO UPDATE
         SET id_kit = EXCLUDED.id_kit, codigo_externo = EXCLUDED.codigo_externo, sync_run_id = EXCLUDED.sync_run_id, fecha_sincronizacion = EXCLUDED.fecha_sincronizacion`,
      [ORIGIN, created.map((group) => kitByCode.get(normalize(group.codigo)) ?? 0), created.map((group) => group.external_id), created.map((group) => normalize(group.codigo)), snapshotId]
    );
    return { created: created.length, skippedExisting, invalidSelection: invalidSelection + unavailable.length, componentsLinked: detailRows.length };
  });
  return { ...result, preview: await summary(snapshotId) };
}
