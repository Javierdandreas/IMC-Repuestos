"use client";

import { useEffect, useState } from "react";
import { PrecioDetalle, ProveedorProducto } from "@/interfaces/productos";
import { calcularCostoBase, CriterioCosto, preciosValidosProveedores } from "@/lib/costos";
import { Package2, ShoppingBag, Users, CreditCard, BadgePercent } from "lucide-react";
import { useMetadata } from "@/context/MetadataContext";

interface PricingSectionProps {
  precios: PrecioDetalle[];
  proveedores: ProveedorProducto[];
  criterioCosto: CriterioCosto;
  onChange: (nuevosPrecios: PrecioDetalle[]) => void;
  onCriterioCostoChange: (criterio: CriterioCosto) => void;
}

type MonedaOrigen = "ARS" | "USD" | "EUR" | "BRL";
type ReferenciaCotizacion = "OFICIAL" | "BLUE" | "MEP" | "CCL";
type LadoCotizacion = "COMPRA" | "VENTA";

type PanelMultimoneda = {
  configuracion: {
    monedaDefault: MonedaOrigen;
    referenciaDefault: ReferenciaCotizacion;
    ladoDefault: LadoCotizacion;
    tipoRecargoDefault: "PORCENTAJE" | "MONTO_FIJO";
    recargoDefault: number;
  };
  cotizaciones: Array<{
    moneda: MonedaOrigen;
    referencia: ReferenciaCotizacion;
    valorCompra: number | null;
    valorVenta: number | null;
  }>;
};

const TIPO_COSTO = 1;
const TIPO_ML = 2;
const TIPO_MOSTRADOR = 3;
const TIPO_CUENTA_CORRIENTE_FALLBACK = 4;
const TIPO_OFERTA_FALLBACK = 5;

const round = (num: number) => Math.round(num * 100) / 100;

const formatMoney = (val: number) => {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(val);
};

interface PriceInputProps {
  value: number;
  onChange: (val: number) => void;
  prefix?: string;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

function PriceInput({ value, onChange, prefix, className, placeholder, disabled = false }: PriceInputProps) {
  const [displayValue, setDisplayValue] = useState(value === 0 ? "" : value.toString());
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(value === 0 ? "" : value.toString());
    }
  }, [value, isFocused]);

  const handleBlur = () => {
    setIsFocused(false);
    // Lógica robusta para detectar puntos de miles y comas decimales
    // Caso 1: Tiene coma (formato es-AR) -> Quitar puntos, cambiar coma por punto decimal
    // Caso 2: No tiene coma -> Mantener como está (asumir formato estándar o solo miles con punto)
    let clean = displayValue;
    if (clean.includes(',')) {
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else if (clean.includes('.') && clean.split('.').pop()?.length === 3 && clean.split('.').length > 1) {
      // Caso especial: "1.500" sin coma, muy probable que sea mil quinientos en formato regional
      // Si tiene exactamente 3 dígitos después del punto, lo tratamos como miles
      clean = clean.replace(/\./g, '');
    }

    const num = parseFloat(clean);
    onChange(isNaN(num) ? 0 : round(num));
  };

  const handleChange = (val: string) => {
    // Permitir solo números y un punto/coma decimal
    const clean = val.replace(/[^0-9.,]/g, "");
    setDisplayValue(clean);
  };

  // Valor formateado para cuando NO hay foco
  const visualValue = value === 0 ? "" : formatMoney(value);

  return (
    <div className="relative w-full">
      {prefix && (
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
          {prefix}
        </span>
      )}
      <input
        type="text"
        value={isFocused ? displayValue : visualValue}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        className={`${className} ${prefix ? "pl-8" : ""}`}
      />
    </div>
  );
}

export function PricingSection({ precios, proveedores, criterioCosto, onChange, onCriterioCostoChange }: PricingSectionProps) {
  const { tiposPrecio } = useMetadata();
  const [panelMoneda, setPanelMoneda] = useState<PanelMultimoneda | null>(null);

  useEffect(() => {
    fetch("/api/multimoneda", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudo cargar las cotizaciones.");
        return response.json() as Promise<PanelMultimoneda>;
      })
      .then(setPanelMoneda)
      .catch(() => setPanelMoneda(null));
  }, []);

  const findTipoPrecio = (descripciones: string[], fallbackId: number, fallbackDescripcion: string) => {
    const match = descripciones
      .map(descripcion => descripcion.toUpperCase())
      .map(descripcion => tiposPrecio.find(item => item.descripcion.toUpperCase() === descripcion))
      .find(Boolean);

    return {
      id: match?.id ?? fallbackId,
      descripcion: match?.descripcion ?? fallbackDescripcion,
      margen_default: match?.margen_default ?? 0,
      activo: match?.activo !== false,
    };
  };

  const tipoCosto = findTipoPrecio(["PRECIO COSTO"], TIPO_COSTO, "PRECIO COSTO");
  const tipoMercadoLibre = findTipoPrecio(["MERCADO LIBRE"], TIPO_ML, "MERCADO LIBRE");
  const tipoMostrador = findTipoPrecio(["MOSTRADOR"], TIPO_MOSTRADOR, "MOSTRADOR");
  const tipoCuentaCorriente = findTipoPrecio(["CUENTA CORRIENTE", "MECANICO"], TIPO_CUENTA_CORRIENTE_FALLBACK, "CUENTA CORRIENTE");
  const tipoOferta = findTipoPrecio(["OFERTA"], TIPO_OFERTA_FALLBACK, "OFERTA");

  const tiposVenta = [tipoMercadoLibre, tipoMostrador, tipoCuentaCorriente, tipoOferta].filter(tipo => tipo.activo);
  const tiposBase = [tipoCosto, ...tiposVenta];

  // Inicializamos Costo
  const costoItem: PrecioDetalle = precios.find(p => p.id_tipo_precio === tipoCosto.id) || {
    id_tipo_precio: tipoCosto.id,
    tipo_descripcion: tipoCosto.descripcion,
    valor: 0,
    porcentaje_ganancia: 0,
    modo_calculo: "MARGEN_COSTO" as const,
  };

  const cotizacionPredeterminada = () => ({
    moneda_origen: panelMoneda?.configuracion.monedaDefault ?? "USD" as MonedaOrigen,
    referencia_cotizacion: panelMoneda?.configuracion.referenciaDefault ?? "OFICIAL" as ReferenciaCotizacion,
    lado_cotizacion: panelMoneda?.configuracion.ladoDefault ?? "VENTA" as LadoCotizacion,
    tipo_recargo_cotizacion: panelMoneda?.configuracion.tipoRecargoDefault ?? "PORCENTAJE" as const,
    recargo_cotizacion: panelMoneda?.configuracion.recargoDefault ?? 0,
  });

  const estimarArs = (precio: PrecioDetalle, importe?: number) => {
    const modo = precio.modo_calculo ?? "MARGEN_COSTO";
    const valorOrigen = Math.max(0, Number(importe ?? precio.importe_origen ?? precio.valor) || 0);
    if (modo === "FIJO_ARS") return round(valorOrigen);
    if (modo !== "FIJO_MONEDA") return round(Number(precio.valor) || 0);
    const quote = panelMoneda?.cotizaciones.find((item) => item.moneda === precio.moneda_origen && item.referencia === precio.referencia_cotizacion);
    const base = precio.lado_cotizacion === "COMPRA" ? quote?.valorCompra : quote?.valorVenta;
    if (!base || base <= 0) return round(Number(precio.valor) || 0);
    const recargo = Math.max(0, Number(precio.recargo_cotizacion) || 0);
    const cotizacion = precio.tipo_recargo_cotizacion === "MONTO_FIJO" ? base + recargo : base * (1 + recargo / 100);
    return round(valorOrigen * cotizacion);
  };

  const syncAllPrices = (currentPrecios: PrecioDetalle[], costoBase?: number): PrecioDetalle[] => {
    const basicTypes = tiposBase.map(tipo => tipo.id);
    const missing = basicTypes.filter(id => !currentPrecios.find(p => p.id_tipo_precio === id));
    
    if (missing.length === 0) return currentPrecios;

    const costo = costoBase ?? currentPrecios.find(p => p.id_tipo_precio === tipoCosto.id)?.valor ?? 0;
    const added: PrecioDetalle[] = missing.map(id => {
      const tipo = tiposBase.find(item => item.id === id);
      const margen = id === tipoCosto.id ? 0 : tipo?.margen_default ?? 0;
      return {
        id_tipo_precio: id,
        tipo_descripcion: tipo?.descripcion ?? "PRECIO",
        valor: round(costo * (1 + margen / 100)),
        porcentaje_ganancia: margen,
        modo_calculo: "MARGEN_COSTO" as const,
      };
    });

    return [...currentPrecios, ...added];
  };

  const handleCostoChange = (val: number) => {
    const basePrecios = syncAllPrices(precios, val);
    const tiposVentaActivos = new Set(tiposVenta.map(tipo => tipo.id));
    const nuevosPrecios = basePrecios.map(p => {
      if (p.id_tipo_precio === tipoCosto.id) {
        const modo = criterioCosto === "MANUAL" && p.modo_calculo === "FIJO_MONEDA"
          ? "FIJO_MONEDA"
          : criterioCosto === "MANUAL" ? "FIJO_ARS" : "MARGEN_COSTO";
        const costoActualizado = { ...p, modo_calculo: modo, importe_origen: modo === "MARGEN_COSTO" ? null : round(val) } as PrecioDetalle;
        return { ...costoActualizado, valor: estimarArs(costoActualizado, val) };
      }
      if (!tiposVentaActivos.has(p.id_tipo_precio)) return p;
      if ((p.modo_calculo ?? "MARGEN_COSTO") !== "MARGEN_COSTO") return p;
      const nuevoValor = val * (1 + (p.porcentaje_ganancia || 0) / 100);
      return { ...p, valor: round(nuevoValor) };
    });

    onChange(nuevosPrecios);
  };

  const preciosProveedor = preciosValidosProveedores(proveedores);
  const costoAutomatico = calcularCostoBase(proveedores, criterioCosto);

  useEffect(() => {
    if (criterioCosto === "PROVEEDOR_UNICO" && preciosProveedor.length > 1) {
      onCriterioCostoChange("MANUAL");
    }
  }, [criterioCosto, onCriterioCostoChange, preciosProveedor.length]);

  useEffect(() => {
    if (costoAutomatico === null) return;
    const costoActual = precios.find((precio) => precio.id_tipo_precio === tipoCosto.id)?.valor;
    if (costoActual === costoAutomatico) return;
    handleCostoChange(costoAutomatico);
  // Solo debe reaccionar al criterio o a los precios asociados de proveedores.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [criterioCosto, proveedores]);

  const updatePrecio = (idTipo: number, field: "valor" | "porcentaje_ganancia", val: number) => {
    const basePrecios = syncAllPrices(precios);
    const costo = basePrecios.find(p => p.id_tipo_precio === tipoCosto.id)?.valor || 0;
    
    const nuevosPrecios = basePrecios.map(p => {
      if (p.id_tipo_precio !== idTipo) return p;

      if ((p.modo_calculo ?? "MARGEN_COSTO") !== "MARGEN_COSTO") {
        const updated = { ...p, importe_origen: round(val) } as PrecioDetalle;
        return { ...updated, valor: estimarArs(updated, val) };
      }

      if (field === "valor") {
        const nuevoMargen = costo > 0 ? ((val / costo) - 1) * 100 : 0;
        return { ...p, valor: round(val), porcentaje_ganancia: round(nuevoMargen) };
      } else {
        const nuevoPrecio = costo * (1 + val / 100);
        return { ...p, porcentaje_ganancia: round(val), valor: round(nuevoPrecio) };
      }
    });
    
    onChange(nuevosPrecios);
  };

  const updateModoPrecio = (idTipo: number, modo: NonNullable<PrecioDetalle["modo_calculo"]>) => {
    const basePrecios = syncAllPrices(precios);
    const defaults = cotizacionPredeterminada();
    const nuevosPrecios = basePrecios.map((precio) => {
      if (precio.id_tipo_precio !== idTipo) return precio;
      if (modo === "MARGEN_COSTO") return { ...precio, modo_calculo: modo, importe_origen: null, moneda_origen: null, referencia_cotizacion: null, lado_cotizacion: null, tipo_recargo_cotizacion: null, recargo_cotizacion: null };
      if (modo === "FIJO_ARS") return { ...precio, modo_calculo: modo, importe_origen: precio.valor, moneda_origen: "ARS" as const, referencia_cotizacion: null, lado_cotizacion: null, tipo_recargo_cotizacion: null, recargo_cotizacion: null, cotizacion_usada: 1 };
      const fixed = { ...precio, modo_calculo: modo, importe_origen: precio.importe_origen ?? 0, ...defaults } as PrecioDetalle;
      return { ...fixed, valor: estimarArs(fixed) };
    });
    onChange(nuevosPrecios);
  };

  const updateCostoMoneda = (field: keyof PrecioDetalle, value: string | number) => {
    const basePrecios = syncAllPrices(precios);
    onChange(basePrecios.map((precio) => {
      if (precio.id_tipo_precio !== tipoCosto.id) return precio;
      const updated = { ...precio, modo_calculo: "FIJO_MONEDA" as const, ...cotizacionPredeterminada(), [field]: value } as PrecioDetalle;
      return { ...updated, valor: estimarArs(updated) };
    }));
  };

  const changeCriterioCosto = (criterio: CriterioCosto) => {
    if (criterio === "MANUAL" && (costoItem.modo_calculo ?? "MARGEN_COSTO") === "MARGEN_COSTO") {
      const basePrecios = syncAllPrices(precios);
      onChange(basePrecios.map((precio) => precio.id_tipo_precio === tipoCosto.id
        ? { ...precio, modo_calculo: "FIJO_ARS" as const, importe_origen: precio.valor, moneda_origen: "ARS" as const, cotizacion_usada: 1 }
        : precio));
    }
    onCriterioCostoChange(criterio);
  };

  const renderPriceRow = (idTipo: number, label: string, Icon: any, colorClass: string) => {
    const item: PrecioDetalle = precios.find(p => p.id_tipo_precio === idTipo) || { id_tipo_precio: idTipo, tipo_descripcion: label, valor: 0, porcentaje_ganancia: 0, modo_calculo: "MARGEN_COSTO" as const };
    const modo = item.modo_calculo ?? "MARGEN_COSTO";
    
    return (
      <div className="group flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 transition-all hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-700">
        <div className="flex items-center gap-2">
          <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${colorClass} bg-opacity-10 text-opacity-100`}>
            <Icon className="h-4 w-4" />
          </div>
          <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest">{label}</span>
        </div>

        <select
          value={modo}
          onChange={(event) => updateModoPrecio(idTipo, event.target.value as NonNullable<PrecioDetalle["modo_calculo"]>)}
          className="h-8 w-full rounded-md border border-slate-200 bg-slate-50 px-2 text-[10px] font-bold text-slate-700 outline-none focus:border-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
        >
          <option value="MARGEN_COSTO">Margen sobre costo</option>
          <option value="FIJO_ARS">Fijo en ARS</option>
          <option value="FIJO_MONEDA">Fijo en moneda</option>
        </select>
        <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-2">
          <div className="flex flex-col gap-1.5">
            <label className="flex h-3 items-center gap-1 px-0.5 text-[9px] font-black uppercase tracking-wider text-slate-400">
              Margen %
            </label>
            <PriceInput
              value={item.porcentaje_ganancia}
              onChange={(val) => updatePrecio(idTipo, "porcentaje_ganancia", val)}
              placeholder="0"
              disabled={modo !== "MARGEN_COSTO"}
              className="h-10 min-w-0 w-full rounded-lg border border-slate-100 bg-slate-50 px-2 text-center text-sm font-bold tabular-nums text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:opacity-40 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-blue-700 dark:focus:ring-blue-900/20"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="flex h-3 items-center gap-1 px-0.5 text-[9px] font-black uppercase tracking-wider text-slate-400">
              Final $
            </label>
            <PriceInput
              value={modo === "MARGEN_COSTO" ? item.valor : Number(item.importe_origen ?? item.valor)}
              onChange={(val) => updatePrecio(idTipo, "valor", val)}
              prefix={modo === "FIJO_MONEDA" ? item.moneda_origen ?? "USD" : "$"}
              placeholder="0"
              className="h-10 min-w-0 w-full rounded-lg border border-slate-100 bg-slate-50 px-2 text-right text-[13px] font-bold tabular-nums text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-blue-700 dark:focus:ring-blue-900/20"
            />
          </div>
        </div>
        {modo === "FIJO_MONEDA" && (
          <p className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">ARS estimado: $ {formatMoney(item.valor)}</p>
        )}
      </div>
    );
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800/50">
        <div className="flex flex-col">
          <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white uppercase">Gestión de Precios</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(330px,1.2fr)_3fr]">
        {/* Costo Section - Primary */}
        <div className="rounded-xl border-2 border-blue-100 bg-blue-50/30 p-4 dark:border-blue-900/20 dark:bg-blue-900/5">
          <div className="mb-2 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-none">
              <Package2 className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <label className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">Costo Base</label>
              <span className="text-[8px] font-bold uppercase text-slate-400 leading-none">Insumo</span>
            </div>
          </div>

          <div className="mb-3 grid grid-cols-5 gap-1.5">
            {([
              ["PROVEEDOR_UNICO", "Único"],
              ["MANUAL", "Manual"],
              ["MENOR_PRECIO", "Menor"],
              ["PROMEDIO_PRECIO", "Promedio"],
              ["MAYOR_PRECIO", "Mayor"],
            ] as const).map(([criterio, label]) => {
              const automatico = criterio !== "MANUAL";
              const disabled = criterio === "PROVEEDOR_UNICO"
                ? preciosProveedor.length !== 1
                : automatico && preciosProveedor.length === 0;
              return (
                <button
                  key={criterio}
                  type="button"
                  disabled={disabled}
                  title={disabled
                    ? criterio === "PROVEEDOR_UNICO"
                      ? "Se usa cuando hay un único proveedor con costo"
                      : "Carga al menos un precio de lista de proveedor"
                    : undefined}
                  onClick={() => changeCriterioCosto(criterio)}
                  className={`h-8 min-w-0 whitespace-nowrap rounded-md border px-1.5 text-[8px] font-black uppercase tracking-normal transition ${criterioCosto === criterio ? "border-blue-500 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-500 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"} disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          
          <PriceInput
            value={costoItem.modo_calculo === "FIJO_MONEDA" ? Number(costoItem.importe_origen ?? costoItem.valor) : costoItem.valor}
            onChange={handleCostoChange}
            disabled={criterioCosto !== "MANUAL"}
            prefix={costoItem.modo_calculo === "FIJO_MONEDA" ? costoItem.moneda_origen ?? "USD" : "$"}
            placeholder="0.00"
            className="h-12 w-full rounded-lg border-none bg-white pr-4 text-lg font-bold text-slate-900 shadow-sm outline-none transition focus:ring-4 focus:ring-blue-200 dark:bg-slate-900 dark:text-white dark:focus:ring-blue-900/30"
          />
          {criterioCosto === "MANUAL" && (
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <select
                value={costoItem.modo_calculo === "FIJO_MONEDA" ? costoItem.moneda_origen ?? "USD" : "ARS"}
                onChange={(event) => {
                  if (event.target.value === "ARS") {
                    const basePrecios = syncAllPrices(precios);
                    onChange(basePrecios.map((precio) => precio.id_tipo_precio === tipoCosto.id
                      ? { ...precio, modo_calculo: "FIJO_ARS" as const, importe_origen: precio.valor, moneda_origen: "ARS" as const, cotizacion_usada: 1 }
                      : precio));
                  } else updateCostoMoneda("moneda_origen", event.target.value as MonedaOrigen);
                }}
                className="h-9 rounded-md border border-blue-100 bg-white px-2 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
              >
                <option value="ARS">ARS</option><option value="USD">USD</option><option value="EUR">EUR</option><option value="BRL">BRL</option>
              </select>
              {costoItem.modo_calculo === "FIJO_MONEDA" && <>
                <select value={costoItem.referencia_cotizacion ?? "OFICIAL"} onChange={(event) => updateCostoMoneda("referencia_cotizacion", event.target.value as ReferenciaCotizacion)} className="h-9 rounded-md border border-blue-100 bg-white px-2 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                  <option value="OFICIAL">Oficial</option><option value="BLUE">Blue</option><option value="MEP">MEP</option><option value="CCL">CCL</option>
                </select>
                <select value={costoItem.lado_cotizacion ?? "VENTA"} onChange={(event) => updateCostoMoneda("lado_cotizacion", event.target.value as LadoCotizacion)} className="h-9 rounded-md border border-blue-100 bg-white px-2 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                  <option value="VENTA">Venta</option><option value="COMPRA">Compra</option>
                </select>
              </>}
            </div>
          )}
          {criterioCosto === "MANUAL" && costoItem.modo_calculo === "FIJO_MONEDA" && (
            <p className="mt-2 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">Equivalente ARS actual: $ {formatMoney(costoItem.valor)}</p>
          )}
        </div>

        {/* Selling Prices - Horizontal Row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {tipoMercadoLibre.activo && renderPriceRow(tipoMercadoLibre.id, tipoMercadoLibre.descripcion, ShoppingBag, "bg-amber-500 text-amber-500")}
          {tipoMostrador.activo && renderPriceRow(tipoMostrador.id, tipoMostrador.descripcion, Users, "bg-emerald-500 text-emerald-500")}
          {tipoCuentaCorriente.activo && renderPriceRow(tipoCuentaCorriente.id, tipoCuentaCorriente.descripcion, CreditCard, "bg-indigo-500 text-indigo-500")}
          {tipoOferta.activo && renderPriceRow(tipoOferta.id, tipoOferta.descripcion, BadgePercent, "bg-rose-500 text-rose-500")}
        </div>
      </div>

    </section>
  );
}


