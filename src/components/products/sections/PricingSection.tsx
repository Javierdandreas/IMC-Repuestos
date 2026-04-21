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

export function PricingSection({ precios, onChange }: PricingSectionProps) {
  // Inicializamos Costo
  const costoItem = precios.find(p => p.id_tipo_precio === TIPO_COSTO) || {
    id_tipo_precio: TIPO_COSTO,
    tipo_descripcion: "PRECIO COSTO",
    valor: 0,
    porcentaje_ganancia: 0
  };

  const handleCostoChange = (val: number) => {
    const nuevosPrecios = precios.map(p => {
      if (p.id_tipo_precio === TIPO_COSTO) {
        return { ...p, valor: val };
      }
      // Al cambiar el costo, recalculamos los precios finales manteniendo el margen
      const nuevoValor = val * (1 + (p.porcentaje_ganancia || 0) / 100);
      return { ...p, valor: nuevoValor };
    });

    // Si no existían los otros, los agregamos (un producto nuevo podría no tenerlos)
    const ids = nuevosPrecios.map(p => p.id_tipo_precio);
    [TIPO_ML, TIPO_MOSTRADOR, TIPO_MECANICO].forEach(id => {
      if (!ids.includes(id)) {
        const desc = id === TIPO_ML ? "MERCADO LIBRE" : id === TIPO_MOSTRADOR ? "MOSTRADOR" : "MECANICO";
        nuevosPrecios.push({
          id_tipo_precio: id,
          tipo_descripcion: desc,
          valor: val, // Inicialmente igual al costo (0% margen)
          porcentaje_ganancia: 0
        });
      }
    });

    onChange(nuevosPrecios);
  };

  const updatePrecio = (idTipo: number, field: "valor" | "porcentaje_ganancia", val: number) => {
    const costo = precios.find(p => p.id_tipo_precio === TIPO_COSTO)?.valor || 0;
    
    const nuevosPrecios = precios.map(p => {
      if (p.id_tipo_precio !== idTipo) return p;

      if (field === "valor") {
        // Al cambiar el precio final, recalculamos el margen
        // margen = ((precio / costo) - 1) * 100
        const nuevoMargen = costo > 0 ? ((val / costo) - 1) * 100 : 0;
        return { ...p, valor: val, porcentaje_ganancia: nuevoMargen };
      } else {
        // Al cambiar el margen, recalculamos el precio final
        // precio = costo * (1 + margen / 100)
        const nuevoPrecio = costo * (1 + val / 100);
        return { ...p, porcentaje_ganancia: val, valor: nuevoPrecio };
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
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
            <span className="text-sm font-black text-slate-900 dark:text-white">Ajuste de Margen</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-1.5 px-1 text-[10px] font-bold uppercase text-slate-400">
              <Percent className="h-3 w-3" /> Margen %
            </label>
            <input
              type="number"
              step="any"
              value={item.porcentaje_ganancia === 0 ? "" : Number(item.porcentaje_ganancia.toFixed(2))}
              onChange={(e) => updatePrecio(idTipo, "porcentaje_ganancia", Number(e.target.value))}
              placeholder="0.00"
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-blue-700 dark:focus:ring-blue-900/20"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-1.5 px-1 text-[10px] font-bold uppercase text-slate-400">
              <DollarSign className="h-3 w-3" /> Precio Final
            </label>
            <input
              type="number"
              step="any"
              value={item.valor === 0 ? "" : Number(item.valor.toFixed(2))}
              onChange={(e) => updatePrecio(idTipo, "valor", Number(e.target.value))}
              placeholder="0.00"
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-blue-700 dark:focus:ring-blue-900/20"
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
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-400">$</span>
          <input
            type="number"
            step="any"
            value={costoItem.valor === 0 ? "" : costoItem.valor}
            onChange={(e) => handleCostoChange(Number(e.target.value))}
            placeholder="0.00"
            className="h-16 w-full rounded-2xl border-none bg-white pl-10 pr-6 text-2xl font-black text-slate-900 shadow-sm outline-none transition focus:ring-4 focus:ring-blue-200 dark:bg-slate-900 dark:text-white dark:focus:ring-blue-900/30"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {renderPriceRow(TIPO_ML, "Mercado Libre", ShoppingBag, "bg-amber-500 text-amber-500")}
        {renderPriceRow(TIPO_MOSTRADOR, "Mostrador", Users, "bg-emerald-500 text-emerald-500")}
        {renderPriceRow(TIPO_MECANICO, "Mecánico", Wrench, "bg-indigo-500 text-indigo-500")}
      </div>
    </section>
  );
}
