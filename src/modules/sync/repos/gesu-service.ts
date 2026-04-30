import { supabaseAdmin as supabase } from '@/utils/supabase/admin';

const GESU_API_BASE_URL = process.env.GESU_API_BASE_URL;
const GESU_API_TOKEN = process.env.GESU_API_TOKEN;

const GESU_FETCH_TIMEOUT_MS = Number(process.env.GESU_FETCH_TIMEOUT_MS || 60000);
const GESU_RUNNING_TTL_MINUTES = Number(process.env.GESU_RUNNING_TTL_MINUTES || 120);

function buildGesuUrl(page: number) {
  if (!GESU_API_BASE_URL) throw new Error('GESU_API_BASE_URL no configurada');
  const url = new URL(GESU_API_BASE_URL);
  url.searchParams.set('pag', String(page));
  url.searchParams.set('token', GESU_API_TOKEN || '');
  return url.toString();
}

function extractItemsFromResponse(data: any) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.result)) return data.result;
  if (Array.isArray(data.results)) return data.results;
  if (data.data && typeof data.data === 'object' && !Array.isArray(data.data)) return Object.values(data.data);
  if (data.items && typeof data.items === 'object' && !Array.isArray(data.items)) return Object.values(data.items);
  return [];
}

function extractHeaderFromResponse(data: any) {
  if (data?.header && typeof data.header === 'object') return data.header;
  return null;
}

function pick(obj: any, keys: string[] = []) {
  for (const key of keys) {
    if (obj?.[key] !== undefined) return obj[key];
  }
  return null;
}

function toNumber(value: any) {
  if (value === null || value === undefined || value === '') return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (raw.includes(',') && raw.includes('.')) {
    const normalized = raw.replace(/\./g, '').replace(',', '.');
    const n = Number(normalized);
    return Number.isNaN(n) ? null : n;
  }
  if (raw.includes(',')) {
    const normalized = raw.replace(',', '.');
    const n = Number(normalized);
    return Number.isNaN(n) ? null : n;
  }
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}

function mapGesuItem(rawItem: any, pageNumber: number, itemIndex: number, syncRunId: any) {
  return {
    source: 'GESU',
    sync_run_id: syncRunId,
    page_number: pageNumber,
    item_index: itemIndex,
    codigo_interno: pick(rawItem, ['codigoInterno', 'CodigoInterno', 'codigo_interno']),
    marca: pick(rawItem, ['marca', 'Marca']),
    titulo: pick(rawItem, ['titulo', 'Titulo', 'title']),
    stock: toNumber(pick(rawItem, ['stock', 'Stock'])),
    precio_final_lista_1: toNumber(pick(rawItem, ['precioFinalLista1', 'PrecioFinalLista1'])),
    precio_final_lista_4: toNumber(pick(rawItem, ['precioFinalLista4', 'PrecioFinalLista4'])),
    precio_final_lista_5: toNumber(pick(rawItem, ['precioFinalLista5', 'PrecioFinalLista5'])),
    ubicacion_interna: pick(rawItem, ['ubicacionInterna', 'UbicacionInterna', 'ubicacion_interna']),
    codigo_proveedor: pick(rawItem, ['codigoProveedor', 'CodigoProveedor', 'codigo_proveedor']),
    tipo: pick(rawItem, ['Tipo', 'tipo']),
    codigo_barras: pick(rawItem, ['CodigoBarras', 'codigoBarras', 'codigo_barras']),
    payload: rawItem
  };
}

async function createSyncRun(metadata = {}) {
  const { data, error } = await supabase
    .from('sync_runs')
    .insert({
      source: 'GESU',
      status: 'running',
      metadata
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateSyncRun(syncRunId: any, patch: any) {
  const { error } = await supabase.from('sync_runs').update(patch).eq('id', syncRunId);
  if (error) throw error;
}

async function mergeSyncRunMetadata(syncRunId: any, metadataPatch = {}) {
  const { data: current } = await supabase.from('sync_runs').select('metadata').eq('id', syncRunId).single();
  const currentMetadata = current?.metadata && typeof current.metadata === 'object' ? current.metadata : {};
  const mergedMetadata = { ...currentMetadata, ...metadataPatch };
  await updateSyncRun(syncRunId, { metadata: mergedMetadata });
  return mergedMetadata;
}

async function updateSyncRunWithMergedMetadata(syncRunId: any, patch: any = {}, metadataPatch = {}) {
  const { data: current } = await supabase.from('sync_runs').select('metadata').eq('id', syncRunId).single();
  const currentMetadata = current?.metadata && typeof current.metadata === 'object' ? current.metadata : {};
  const mergedMetadata = { ...currentMetadata, ...metadataPatch };
  const finalPatch = { ...patch, metadata: mergedMetadata };
  await updateSyncRun(syncRunId, finalPatch);
  return mergedMetadata;
}

async function clearGesuRawTable() {
  const { error } = await supabase.rpc('truncate_gesu_items_raw');
  if (error) throw error;
}

async function resolveRunningGesuSyncRun() {
  const { data: runningSyncRun } = await supabase
    .from('sync_runs')
    .select('id, started_at')
    .eq('source', 'GESU')
    .eq('status', 'running')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!runningSyncRun) return { activeRun: null };

  const startedAt = new Date(runningSyncRun.started_at);
  const expiresAt = new Date(startedAt.getTime() + GESU_RUNNING_TTL_MINUTES * 60 * 1000);
  const isStale = new Date() > expiresAt;

  if (!isStale) return { activeRun: runningSyncRun };

  await updateSyncRunWithMergedMetadata(
    runningSyncRun.id,
    {
      finished_at: new Date().toISOString(),
      status: 'error',
      error_message: `Sync GESU marcada como error por timeout de ejecución`
    },
    { stale_run_auto_closed: true }
  );
  return { activeRun: null };
}

async function fetchGesuPage(pageNumber = 1) {
  const url = buildGesuUrl(pageNumber);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GESU_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`GESU respondió ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function importGesuPageWithSyncRun(pageNumber: number, syncRunId: any) {
  const rawResponse = await fetchGesuPage(pageNumber);
  const header = extractHeaderFromResponse(rawResponse);
  const items = extractItemsFromResponse(rawResponse);
  if (!items.length) return { pageNumber, header, fetched: 0, inserted: 0, hasMore: false };

  const rows = items.map((item: any, index: number) => mapGesuItem(item, pageNumber, index + 1, syncRunId));
  const { error } = await supabase.from('gesu_items_raw').insert(rows);
  if (error) throw error;

  const hasMore = header?.data_pag ? Number(header.data_pag) >= 1000 : items.length >= 1000;
  return { pageNumber, header, fetched: items.length, inserted: rows.length, hasMore };
}

export async function importGesuAllPages(options: any = {}) {
  const { mode = 'manual_full_import', skipIfRunning = true, metadata: extraMetadata = {} } = options;

  // BLOQUEO DE SEGURIDAD CONTRA EL FANTASMA
  if (mode === 'scheduled_full_import') {
    return {
      ok: false,
      skipped: true,
      reason: 'Sincronización automática bloqueada por Mantenimiento Profesional'
    };
  }

  if (skipIfRunning) {
    const { activeRun } = await resolveRunningGesuSyncRun();
    if (activeRun) return { ok: false, skipped: true, reason: 'Ya hay una importación GESU en curso' };
  }

  const syncRun = await createSyncRun({
    mode,
    fetch_timeout_ms: GESU_FETCH_TIMEOUT_MS,
    version_tag: "V2_BLOCK_ACTIVE_20260410", // Etiqueta para identificar este código
    ...extraMetadata
  });
  let page = 1;
  let totalFetched = 0;
  let totalInserted = 0;
  let pagesProcessed = 0;

  try {
    await clearGesuRawTable();
    while (true) {
      const result = await importGesuPageWithSyncRun(page, syncRun.id);
      totalFetched += result.fetched;
      totalInserted += result.inserted;
      if (result.fetched > 0) pagesProcessed += 1;

      await updateSyncRunWithMergedMetadata(syncRun.id, {
        pages_requested: page,
        pages_processed: pagesProcessed,
        records_fetched: totalFetched,
        records_inserted: totalInserted
      });

      if (result.fetched === 0 || !result.hasMore) break;
      page += 1;
    }

    await updateSyncRunWithMergedMetadata(syncRun.id, {
      finished_at: new Date().toISOString(),
      status: 'success'
    });

    return { ok: true, syncRunId: syncRun.id, pagesProcessed, fetched: totalFetched, inserted: totalInserted };
  } catch (error: any) {
    await updateSyncRunWithMergedMetadata(syncRun.id, {
      finished_at: new Date().toISOString(),
      status: 'error',
      error_message: error.message
    });
    throw error;
  }
}

