"use client";

import { useEffect, useState } from "react";
import { PrecioDetalle } from "@/interfaces/productos";
import { Package2, Percent, DollarSign, TrendingUp, ShoppingBag, Users, Wrench } from "lucide-react";

interface PricingSectionProps {
  precios: PrecioDetalle[];
  onChange: (nuevosPrecios: PrecioDetalle[]) => void;
}

const TIPO_COSTO = 1;
const TIPO_ML = 2;
const TIPO_MOSTRADOR = 3;
const TIPO_MECANICO = 4;

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
  // Inicializamos Costo
  const costoItem = precios.find(p => p.id_tipo_precio === TIPO_COSTO) || {
    id_tipo_precio: TIPO_COSTO,
    tipo_descripcion: "PRECIO COSTO",
    valor: 0,
    porcentaje_ganancia: 0
  };

  const syncAllPrices = (currentPrecios: PrecioDetalle[]) => {
    const basicTypes = [TIPO_COSTO, TIPO_ML, TIPO_MOSTRADOR, TIPO_MECANICO];
    const missing = basicTypes.filter(id => !currentPrecios.find(p => p.id_tipo_precio === id));
    
    if (missing.length === 0) return currentPrecios;

    const added = missing.map(id => ({
      id_tipo_precio: id,
      tipo_descripcion: id === TIPO_COSTO ? "PRECIO COSTO" : id === TIPO_ML ? "MERCADO LIBRE" : id === TIPO_MOSTRADOR ? "MOSTRADOR" : "MECANICO",
      valor: 0,
      porcentaje_ganancia: 0
    }));

    return [...currentPrecios, ...added];
  };

  const handleCostoChange = (val: number) => {
    const basePrecios = syncAllPrices(precios);
    const nuevosPrecios = basePrecios.map(p => {
      if (p.id_tipo_precio === TIPO_COSTO) {
        return { ...p, valor: round(val) };
      }
      const nuevoValor = val * (1 + (p.porcentaje_ganancia || 0) / 100);
      return { ...p, valor: round(nuevoValor) };
    });

    onChange(nuevosPrecios);
  };

  const updatePrecio = (idTipo: number, field: "valor" | "porcentaje_ganancia", val: number) => {
    const basePrecios = syncAllPrices(precios);
    const costo = basePrecios.find(p => p.id_tipo_precio === TIPO_COSTO)?.valor || 0;
    
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
      <div className="group relative flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 transition-all hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-700">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${colorClass} bg-opacity-10 text-opacity-100`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-black text-slate-900 dark:text-white uppercase">{label}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-1.5 px-1 text-[10px] font-bold uppercase text-slate-400">
              <Percent className="h-3 w-3" /> Margen
            </label>
            <PriceInput
              value={item.porcentaje_ganancia}
              onChange={(val) => updatePrecio(idTipo, "porcentaje_ganancia", val)}
              placeholder="0.00"
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-blue-700 dark:focus:ring-blue-900/20"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-1.5 px-1 text-[10px] font-bold uppercase text-slate-400">
              <DollarSign className="h-3 w-3" /> Precio Final
            </label>
            <PriceInput
              value={item.valor}
              onChange={(val) => updatePrecio(idTipo, "valor", val)}
              placeholder="0.00"
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-blue-700 dark:focus:ring-blue-900/20"
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Gestión de Precios</h2>
          <p className="text-sm font-medium text-slate-500">Configurá el costo base y los márgenes de venta.</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
          <TrendingUp className="h-6 w-6" />
        </div>
      </div>

      <div className="rounded-3xl border-2 border-blue-100 bg-blue-50/30 p-6 dark:border-blue-900/20 dark:bg-blue-900/5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-none">
            <Package2 className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">Costo del Producto</label>
            <span className="text-xs font-medium text-slate-500 leading-none">Base para todos los cálculos</span>
          </div>
        </div>
        
        <PriceInput
          value={costoItem.valor}
          onChange={handleCostoChange}
          prefix="$"
          placeholder="0.00"
          className="h-16 w-full rounded-2xl border-none bg-white pr-6 text-2xl font-black text-slate-900 shadow-sm outline-none transition focus:ring-4 focus:ring-blue-200 dark:bg-slate-900 dark:text-white dark:focus:ring-blue-900/30"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {renderPriceRow(TIPO_ML, "Mercado Libre", ShoppingBag, "bg-amber-500 text-amber-500")}
        {renderPriceRow(TIPO_MOSTRADOR, "Mostrador", Users, "bg-emerald-500 text-emerald-500")}
        {renderPriceRow(TIPO_MECANICO, "Mecánico", Wrench, "bg-indigo-500 text-indigo-500")}
      </div>
    </section>
  );
}


