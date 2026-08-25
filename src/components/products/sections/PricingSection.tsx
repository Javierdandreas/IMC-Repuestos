"use client";

import { useEffect, useState } from "react";
import { PrecioDetalle } from "@/interfaces/productos";
import { Package2, ShoppingBag, Users, CreditCard, BadgePercent } from "lucide-react";
import { useMetadata } from "@/context/MetadataContext";

interface PricingSectionProps {
  precios: PrecioDetalle[];
  onChange: (nuevosPrecios: PrecioDetalle[]) => void;
}

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
}

function PriceInput({ value, onChange, prefix, className, placeholder }: PriceInputProps) {
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
        className={`${className} ${prefix ? "pl-8" : "px-4"}`}
      />
    </div>
  );
}

export function PricingSection({ precios, onChange }: PricingSectionProps) {
  const { tiposPrecio } = useMetadata();

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
  const costoItem = precios.find(p => p.id_tipo_precio === tipoCosto.id) || {
    id_tipo_precio: tipoCosto.id,
    tipo_descripcion: tipoCosto.descripcion,
    valor: 0,
    porcentaje_ganancia: 0
  };

  const syncAllPrices = (currentPrecios: PrecioDetalle[], costoBase?: number) => {
    const basicTypes = tiposBase.map(tipo => tipo.id);
    const missing = basicTypes.filter(id => !currentPrecios.find(p => p.id_tipo_precio === id));
    
    if (missing.length === 0) return currentPrecios;

    const costo = costoBase ?? currentPrecios.find(p => p.id_tipo_precio === tipoCosto.id)?.valor ?? 0;
    const added = missing.map(id => {
      const tipo = tiposBase.find(item => item.id === id);
      const margen = id === tipoCosto.id ? 0 : tipo?.margen_default ?? 0;
      return {
        id_tipo_precio: id,
        tipo_descripcion: tipo?.descripcion ?? "PRECIO",
        valor: round(costo * (1 + margen / 100)),
        porcentaje_ganancia: margen
      };
    });

    return [...currentPrecios, ...added];
  };

  const handleCostoChange = (val: number) => {
    const basePrecios = syncAllPrices(precios, val);
    const tiposVentaActivos = new Set(tiposVenta.map(tipo => tipo.id));
    const nuevosPrecios = basePrecios.map(p => {
      if (p.id_tipo_precio === tipoCosto.id) {
        return { ...p, valor: round(val) };
      }
      if (!tiposVentaActivos.has(p.id_tipo_precio)) return p;
      const nuevoValor = val * (1 + (p.porcentaje_ganancia || 0) / 100);
      return { ...p, valor: round(nuevoValor) };
    });

    onChange(nuevosPrecios);
  };

  const updatePrecio = (idTipo: number, field: "valor" | "porcentaje_ganancia", val: number) => {
    const basePrecios = syncAllPrices(precios);
    const costo = basePrecios.find(p => p.id_tipo_precio === tipoCosto.id)?.valor || 0;
    
    const nuevosPrecios = basePrecios.map(p => {
      if (p.id_tipo_precio !== idTipo) return p;

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

  const renderPriceRow = (idTipo: number, label: string, Icon: any, colorClass: string) => {
    const item = precios.find(p => p.id_tipo_precio === idTipo) || { valor: 0, porcentaje_ganancia: 0 };
    
    return (
      <div className="group flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 transition-all hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-700">
        <div className="flex items-center gap-2">
          <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${colorClass} bg-opacity-10 text-opacity-100`}>
            <Icon className="h-4 w-4" />
          </div>
          <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest">{label}</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-1 px-0.5 text-[8px] font-black uppercase tracking-widest text-slate-400">
              Margen %
            </label>
            <PriceInput
              value={item.porcentaje_ganancia}
              onChange={(val) => updatePrecio(idTipo, "porcentaje_ganancia", val)}
              placeholder="0"
              className="h-10 w-full rounded-lg border border-slate-100 bg-slate-50 px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-blue-700 dark:focus:ring-blue-900/20"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-1 px-0.5 text-[9px] font-black uppercase tracking-widest text-slate-400">
              Final $
            </label>
            <PriceInput
              value={item.valor}
              onChange={(val) => updatePrecio(idTipo, "valor", val)}
              placeholder="0"
              className="h-10 w-full rounded-lg border border-slate-100 bg-slate-50 px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-blue-700 dark:focus:ring-blue-900/20"
            />
          </div>
        </div>
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

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_3fr]">
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
          
          <PriceInput
            value={costoItem.valor}
            onChange={handleCostoChange}
            prefix="$"
            placeholder="0.00"
            className="h-12 w-full rounded-lg border-none bg-white pr-4 text-lg font-bold text-slate-900 shadow-sm outline-none transition focus:ring-4 focus:ring-blue-200 dark:bg-slate-900 dark:text-white dark:focus:ring-blue-900/30"
          />
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


