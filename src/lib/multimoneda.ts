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
      `SELECT DISTINCT ON (moneda, referencia)
        id, moneda, referencia, valor_compra, valor_venta, estado, fuente, observacion, actualizado_at
       FROM public.moneda_cotizacion
       ORDER BY moneda, referencia, actualizado_at DESC, id DESC`
    ),
  ]);
  return { configuracion, cotizaciones: cotizaciones.rows.map(asQuote) };
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
