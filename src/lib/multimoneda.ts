import "server-only";
import { AppError } from "@/lib/api-errors";
import { query, withTransaction } from "@/lib/db-utils";

export const MONEDAS = ["ARS", "USD", "EUR", "BRL"] as const;
export const REFERENCIAS_COTIZACION = ["OFICIAL", "BLUE", "MEP", "CCL"] as const;
export const LADOS_COTIZACION = ["COMPRA", "VENTA"] as const;
export const TIPOS_RECARGO = ["PORCENTAJE", "MONTO_FIJO"] as const;

export type Moneda = typeof MONEDAS[number];
export type ReferenciaCotizacion = typeof REFERENCIAS_COTIZACION[number];
export type LadoCotizacion = typeof LADOS_COTIZACION[number];
export type TipoRecargo = typeof TIPOS_RECARGO[number];

export type ConfiguracionMultimoneda = {
  monedaDefault: Moneda;
  referenciaDefault: ReferenciaCotizacion;
  ladoDefault: LadoCotizacion;
  tipoRecargoDefault: TipoRecargo;
  recargoDefault: number;
  umbralAprobacionPorcentaje: number;
  updatedAt: string;
};

export type CotizacionMoneda = {
  id: number;
  moneda: Moneda;
  referencia: ReferenciaCotizacion;
  valorCompra: number | null;
  valorVenta: number | null;
  estado: "VIGENTE" | "ERROR";
  fuente: "MANUAL" | "AUTOMATICA";
  observacion: string | null;
  actualizadoAt: string;
};

export type ModoCotizacion = "MANUAL" | "AUTOMATICA";
export type CotizacionConfigurada = {
  codigo: string;
  etiqueta: string;
  moneda: Moneda;
  referencia: ReferenciaCotizacion;
  origenApi: string;
  modo: ModoCotizacion;
  tipoRecargo: TipoRecargo;
  recargo: number;
  valorActual: number | null;
  valorCompra: number | null;
  valorVenta: number | null;
  fuente: CotizacionMoneda["fuente"] | null;
  actualizadoAt: string | null;
};

export type ConfiguracionMonedaProveedor = {
  heredaGlobal: boolean;
  moneda: Moneda;
  referencia: ReferenciaCotizacion;
  lado: LadoCotizacion;
  tipoRecargo: TipoRecargo;
  recargo: number;
  updatedAt: string | null;
};

const isOneOf = <T extends readonly string[]>(value: unknown, options: T): value is T[number] =>
  typeof value === "string" && options.includes(value as T[number]);

function asDate(value: unknown) {
  return value instanceof Date ? value.toISOString() : String(value);
}

function asConfiguration(row: Record<string, unknown>): ConfiguracionMultimoneda {
  return {
    monedaDefault: String(row.moneda_default) as Moneda,
    referenciaDefault: String(row.referencia_default) as ReferenciaCotizacion,
    ladoDefault: String(row.lado_default) as LadoCotizacion,
    tipoRecargoDefault: String(row.tipo_recargo_default) as TipoRecargo,
    recargoDefault: Number(row.recargo_default),
    umbralAprobacionPorcentaje: Number(row.umbral_aprobacion_porcentaje),
    updatedAt: asDate(row.updated_at),
  };
}

function asQuote(row: Record<string, unknown>): CotizacionMoneda {
  return {
    id: Number(row.id),
    moneda: String(row.moneda) as Moneda,
    referencia: String(row.referencia) as ReferenciaCotizacion,
    valorCompra: row.valor_compra === null ? null : Number(row.valor_compra),
    valorVenta: row.valor_venta === null ? null : Number(row.valor_venta),
    estado: String(row.estado) as CotizacionMoneda["estado"],
    fuente: String(row.fuente) as CotizacionMoneda["fuente"],
    observacion: row.observacion ? String(row.observacion) : null,
    actualizadoAt: asDate(row.actualizado_at),
  };
}

function asConfiguredQuote(row: Record<string, unknown>): CotizacionConfigurada {
  return {
    codigo: String(row.codigo),
    etiqueta: String(row.etiqueta),
    moneda: String(row.moneda) as Moneda,
    referencia: String(row.referencia) as ReferenciaCotizacion,
    origenApi: String(row.origen_api),
    modo: String(row.modo) as ModoCotizacion,
    tipoRecargo: String(row.tipo_recargo) as TipoRecargo,
    recargo: Number(row.recargo),
    valorActual: row.valor_actual === null ? null : Number(row.valor_actual),
    valorCompra: row.valor_compra === null ? null : Number(row.valor_compra),
    valorVenta: row.valor_venta === null ? null : Number(row.valor_venta),
    fuente: row.fuente ? String(row.fuente) as CotizacionMoneda["fuente"] : null,
    actualizadoAt: row.actualizado_at ? asDate(row.actualizado_at) : null,
  };
}

export async function getConfiguracionMultimoneda(): Promise<ConfiguracionMultimoneda> {
  const result = await query<Record<string, unknown>>(
    "SELECT moneda_default, referencia_default, lado_default, tipo_recargo_default, recargo_default, umbral_aprobacion_porcentaje, updated_at FROM public.multimoneda_configuracion WHERE id = 1"
  );
  if (!result.rows[0]) throw new AppError("Falta inicializar la configuracion multimoneda.", 503);
  return asConfiguration(result.rows[0]);
}

export async function getPanelMultimoneda() {
  const [configuracion, cotizaciones] = await Promise.all([
    getConfiguracionMultimoneda(),
    query<Record<string, unknown>>(
      `SELECT configuracion.codigo, configuracion.etiqueta, configuracion.moneda, configuracion.referencia,
        configuracion.origen_api, configuracion.modo, configuracion.tipo_recargo, configuracion.recargo,
        cotizacion.valor_compra, cotizacion.valor_venta, cotizacion.fuente, cotizacion.actualizado_at,
        COALESCE(cotizacion.valor_venta, cotizacion.valor_compra) AS valor_actual
       FROM public.moneda_cotizacion_configuracion AS configuracion
       LEFT JOIN LATERAL (
         SELECT valor_compra, valor_venta, fuente, actualizado_at
         FROM public.moneda_cotizacion
         WHERE moneda = configuracion.moneda AND referencia = configuracion.referencia AND estado = 'VIGENTE'
         ORDER BY actualizado_at DESC, id DESC
         LIMIT 1
       ) AS cotizacion ON TRUE
       ORDER BY CASE configuracion.codigo
         WHEN 'USD_BLUE' THEN 1 WHEN 'USD_CCL' THEN 2 WHEN 'USD_MEP' THEN 3
         WHEN 'USD_OFICIAL' THEN 4 WHEN 'EUR_OFICIAL' THEN 5 WHEN 'BRL_OFICIAL' THEN 6 ELSE 99 END`
    ),
  ]);
  return { configuracion, cotizaciones: cotizaciones.rows.map(asConfiguredQuote) };
}

export async function saveConfiguracionMultimoneda(input: Omit<ConfiguracionMultimoneda, "updatedAt">) {
  if (!isOneOf(input.monedaDefault, MONEDAS) || !isOneOf(input.referenciaDefault, REFERENCIAS_COTIZACION)
    || !isOneOf(input.ladoDefault, LADOS_COTIZACION) || !isOneOf(input.tipoRecargoDefault, TIPOS_RECARGO)) {
    throw new AppError("La regla global de moneda no es valida.", 400);
  }
  if (!Number.isFinite(input.recargoDefault) || input.recargoDefault < 0 || !Number.isFinite(input.umbralAprobacionPorcentaje)
    || input.umbralAprobacionPorcentaje < 0 || input.umbralAprobacionPorcentaje > 100) {
    throw new AppError("Revisa el recargo y el umbral de aprobacion.", 400);
  }
  const result = await query<Record<string, unknown>>(
    `UPDATE public.multimoneda_configuracion
     SET moneda_default = $1, referencia_default = $2, lado_default = $3, tipo_recargo_default = $4,
       recargo_default = $5, umbral_aprobacion_porcentaje = $6, updated_at = NOW()
     WHERE id = 1
     RETURNING moneda_default, referencia_default, lado_default, tipo_recargo_default, recargo_default, umbral_aprobacion_porcentaje, updated_at`,
    [input.monedaDefault, input.referenciaDefault, input.ladoDefault, input.tipoRecargoDefault, input.recargoDefault, input.umbralAprobacionPorcentaje]
  );
  return asConfiguration(result.rows[0]);
}

export async function registerManualCurrencyQuote(input: {
  moneda: Moneda;
  referencia: ReferenciaCotizacion;
  valorCompra: number | null;
  valorVenta: number | null;
  observacion?: string | null;
}) {
  if (!isOneOf(input.moneda, MONEDAS) || !isOneOf(input.referencia, REFERENCIAS_COTIZACION)) {
    throw new AppError("La moneda o referencia no es valida.", 400);
  }
  if ((input.valorCompra === null || input.valorCompra <= 0) && (input.valorVenta === null || input.valorVenta <= 0)) {
    throw new AppError("Indica al menos una cotizacion positiva.", 400);
  }
  const result = await query<Record<string, unknown>>(
    `INSERT INTO public.moneda_cotizacion (moneda, referencia, valor_compra, valor_venta, estado, fuente, observacion)
     VALUES ($1, $2, $3, $4, 'VIGENTE', 'MANUAL', NULLIF(BTRIM($5), ''))
     RETURNING id, moneda, referencia, valor_compra, valor_venta, estado, fuente, observacion, actualizado_at`,
    [input.moneda, input.referencia, input.valorCompra, input.valorVenta, input.observacion ?? null]
  );
  return asQuote(result.rows[0]);
}

export async function saveCotizacionesConfiguradas(input: Array<{
  codigo: string;
  modo: ModoCotizacion;
  tipoRecargo: TipoRecargo;
  recargo: number;
  valorManual: number | null;
}>) {
  if (!input.length || input.length > 20) throw new AppError("Las cotizaciones configuradas no son validas.", 400);
  await withTransaction(async (db) => {
    const configured = await db.query<Record<string, unknown>>(
      "SELECT codigo, moneda, referencia FROM public.moneda_cotizacion_configuracion WHERE codigo = ANY($1::text[]) FOR UPDATE",
      [input.map((item) => item.codigo)]
    );
    if (configured.rows.length !== input.length) throw new AppError("Una cotizacion configurada ya no existe.", 404);
    const byCode = new Map(configured.rows.map((row) => [String(row.codigo), row]));

    for (const item of input) {
      const quote = byCode.get(item.codigo);
      if (!quote || !["MANUAL", "AUTOMATICA"].includes(item.modo) || !isOneOf(item.tipoRecargo, TIPOS_RECARGO)
        || !Number.isFinite(item.recargo) || item.recargo < 0) {
        throw new AppError("Revisa el modo y recargo de las cotizaciones.", 400);
      }
      if (item.modo === "MANUAL" && (!Number.isFinite(item.valorManual) || Number(item.valorManual) <= 0)) {
        throw new AppError(`Indica una cotizacion manual valida para ${item.codigo}.`, 400);
      }
      await db.query(
        `UPDATE public.moneda_cotizacion_configuracion
         SET modo = $2, tipo_recargo = $3, recargo = $4, updated_at = NOW()
         WHERE codigo = $1`,
        [item.codigo, item.modo, item.tipoRecargo, item.recargo]
      );
      if (item.modo !== "MANUAL") continue;

      const previous = await db.query<{ valor: number | null; fuente: CotizacionMoneda["fuente"] }>(
        `SELECT COALESCE(valor_venta, valor_compra) AS valor, fuente
         FROM public.moneda_cotizacion
         WHERE moneda = $1 AND referencia = $2 AND estado = 'VIGENTE'
         ORDER BY actualizado_at DESC, id DESC LIMIT 1`,
        [quote.moneda, quote.referencia]
      );
      const value = Number(item.valorManual);
      if (Number(previous.rows[0]?.valor) === value && previous.rows[0]?.fuente === "MANUAL") continue;
      await db.query(
        `INSERT INTO public.moneda_cotizacion (moneda, referencia, valor_compra, valor_venta, estado, fuente, observacion)
         VALUES ($1, $2, NULL, $3, 'VIGENTE', 'MANUAL', 'Carga manual desde multimoneda')`,
        [quote.moneda, quote.referencia, value]
      );
    }
  });
  return getPanelMultimoneda();
}

type ExternalQuote = { currency?: string; origin?: string; buy?: number | null; sell?: number | null; updatedAt?: string };

async function getAutomaticSources() {
  const primaryResponse = await fetch("https://monedapi.ar/api/v2/quotes", {
    headers: { "User-Agent": "IMC-Repuestos/1.0" },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!primaryResponse.ok) throw new AppError(`MonedAPI respondio ${primaryResponse.status}.`, 502);
  const primary = await primaryResponse.json() as ExternalQuote[];
  return Array.isArray(primary) ? primary : [];
}

async function getFallbackSources() {
  const response = await fetch("https://dolarapi.com/v1/dolares", {
    headers: { "User-Agent": "IMC-Repuestos/1.0" },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new AppError(`DolarAPI respondio ${response.status}.`, 502);
  const data = await response.json() as Array<{ moneda?: string; casa?: string; compra?: number | null; venta?: number | null; fechaActualizacion?: string }>;
  return Array.isArray(data) ? data : [];
}

function fromMonedApi(moneda: string, origen: string, quotes: ExternalQuote[]) {
  const origin = origen.replace(/^MONEDAPI_/, "");
  const row = quotes.find((quote) => quote.currency === moneda && quote.origin === origin);
  if (!row) return null;
  return { compra: row.buy === null || row.buy === undefined ? null : Number(row.buy), venta: row.sell === null || row.sell === undefined ? null : Number(row.sell), detail: `MonedAPI ${row.updatedAt || ""}`.trim() };
}

function fromDolarApi(moneda: string, origen: string, quotes: Awaited<ReturnType<typeof getFallbackSources>>) {
  const fallbackCasa: Record<string, string> = {
    MONEDAPI_BLUE: "blue", MONEDAPI_CCL: "contadoconliqui", MONEDAPI_BOLSA: "bolsa", MONEDAPI_BNA: "oficial",
  };
  const casa = moneda === "USD" ? fallbackCasa[origen] : undefined;
  if (!casa) return null;
  const row = quotes.find((quote) => quote.casa === casa);
  if (!row) return null;
  return { compra: row.compra === null || row.compra === undefined ? null : Number(row.compra), venta: row.venta === null || row.venta === undefined ? null : Number(row.venta), detail: `DolarAPI ${row.fechaActualizacion || ""}`.trim() };
}

const sameValue = (left: number | null, right: number | null) => left === right || (left !== null && right !== null && Math.abs(left - right) < 0.0001);

export async function sincronizarCotizacionesAutomaticas() {
  const configured = await query<Record<string, unknown>>(
    "SELECT codigo, moneda, referencia, origen_api FROM public.moneda_cotizacion_configuracion WHERE modo = 'AUTOMATICA' ORDER BY codigo"
  );
  let primary: ExternalQuote[] = [];
  let fallback: Awaited<ReturnType<typeof getFallbackSources>> | null = null;
  let primaryError: string | null = null;
  try { primary = await getAutomaticSources(); } catch (error) { primaryError = error instanceof Error ? error.message : "No se pudo consultar MonedAPI."; }

  const result = { actualizadas: 0, sinCambios: 0, errores: 0 };
  for (const config of configured.rows) {
    const origen = String(config.origen_api);
    let value = primary.length ? fromMonedApi(String(config.moneda), origen, primary) : null;
    if (!value) {
      try {
        fallback ??= await getFallbackSources();
        value = fromDolarApi(String(config.moneda), origen, fallback);
      } catch (error) {
        primaryError = [primaryError, error instanceof Error ? error.message : "No se pudo consultar DolarAPI."].filter(Boolean).join(" ");
      }
    }
    if (!value || ((value.compra === null || value.compra <= 0) && (value.venta === null || value.venta <= 0))) {
      await query(
        `INSERT INTO public.moneda_cotizacion (moneda, referencia, estado, fuente, observacion)
         VALUES ($1, $2, 'ERROR', 'AUTOMATICA', $3)`,
        [config.moneda, config.referencia, `Sin cotizacion para ${origen}. ${primaryError || ""}`.trim()]
      );
      result.errores += 1;
      continue;
    }
    const previous = await query<{ valor_compra: number | null; valor_venta: number | null; fuente: CotizacionMoneda["fuente"] }>(
      `SELECT valor_compra, valor_venta, fuente FROM public.moneda_cotizacion
       WHERE moneda = $1 AND referencia = $2 AND estado = 'VIGENTE'
       ORDER BY actualizado_at DESC, id DESC LIMIT 1`,
      [config.moneda, config.referencia]
    );
    if (previous.rows[0]?.fuente === "AUTOMATICA"
      && sameValue(previous.rows[0]?.valor_compra ?? null, value.compra)
      && sameValue(previous.rows[0]?.valor_venta ?? null, value.venta)) {
      result.sinCambios += 1;
      continue;
    }
    await query(
      `INSERT INTO public.moneda_cotizacion (moneda, referencia, valor_compra, valor_venta, estado, fuente, observacion)
       VALUES ($1, $2, $3, $4, 'VIGENTE', 'AUTOMATICA', $5)`,
      [config.moneda, config.referencia, value.compra, value.venta, value.detail]
    );
    result.actualizadas += 1;
  }
  return result;
}

export async function getConfiguracionMonedaProveedor(idProveedor: number): Promise<ConfiguracionMonedaProveedor> {
  const [global, provider] = await Promise.all([
    getConfiguracionMultimoneda(),
    query<Record<string, unknown>>(
      "SELECT moneda, referencia, lado, tipo_recargo, recargo, updated_at FROM public.proveedor_moneda_configuracion WHERE id_proveedor = $1",
      [idProveedor]
    ),
  ]);
  const row = provider.rows[0];
  if (!row) return {
    heredaGlobal: true,
    moneda: global.monedaDefault,
    referencia: global.referenciaDefault,
    lado: global.ladoDefault,
    tipoRecargo: global.tipoRecargoDefault,
    recargo: global.recargoDefault,
    updatedAt: null,
  };
  return {
    heredaGlobal: false,
    moneda: String(row.moneda) as Moneda,
    referencia: String(row.referencia) as ReferenciaCotizacion,
    lado: String(row.lado) as LadoCotizacion,
    tipoRecargo: String(row.tipo_recargo) as TipoRecargo,
    recargo: Number(row.recargo),
    updatedAt: asDate(row.updated_at),
  };
}

export async function saveConfiguracionMonedaProveedor(idProveedor: number, input: Omit<ConfiguracionMonedaProveedor, "updatedAt">) {
  if (!Number.isInteger(idProveedor) || idProveedor <= 0) throw new AppError("Proveedor invalido.", 400);
  if (input.heredaGlobal) {
    await query("DELETE FROM public.proveedor_moneda_configuracion WHERE id_proveedor = $1", [idProveedor]);
    return getConfiguracionMonedaProveedor(idProveedor);
  }
  if (!isOneOf(input.moneda, MONEDAS) || !isOneOf(input.referencia, REFERENCIAS_COTIZACION)
    || !isOneOf(input.lado, LADOS_COTIZACION) || !isOneOf(input.tipoRecargo, TIPOS_RECARGO)
    || !Number.isFinite(input.recargo) || input.recargo < 0) {
    throw new AppError("La configuracion de moneda del proveedor no es valida.", 400);
  }
  await withTransaction(async (db) => {
    const provider = await db.query("SELECT id FROM public.proveedores WHERE id = $1", [idProveedor]);
    if (!provider.rowCount) throw new AppError("Proveedor no encontrado.", 404);
    await db.query(
      `INSERT INTO public.proveedor_moneda_configuracion (id_proveedor, moneda, referencia, lado, tipo_recargo, recargo)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id_proveedor) DO UPDATE
         SET moneda = EXCLUDED.moneda, referencia = EXCLUDED.referencia, lado = EXCLUDED.lado,
           tipo_recargo = EXCLUDED.tipo_recargo, recargo = EXCLUDED.recargo, updated_at = NOW()`,
      [idProveedor, input.moneda, input.referencia, input.lado, input.tipoRecargo, input.recargo]
    );
  });
  return getConfiguracionMonedaProveedor(idProveedor);
}
