"use client";

import { useEffect, useId, useState } from "react";
import { HiCheck, HiChevronDown, HiPencil, HiPlus, HiTrash, HiX } from "react-icons/hi";
import type { CatalogoItem, Subcategoria } from "@/interfaces/productos";
import { calcularPrecioCliente, claveReglaCliente, resolverDescuentoCliente, type ContextoDescuentoCliente, type ReglaDescuentoCliente } from "@/lib/descuentos-cliente";

type Props = {
  value: ReglaDescuentoCliente[];
  onChange: (rules: ReglaDescuentoCliente[]) => void;
  onDraftChange: (pending: boolean) => void;
  marcas: CatalogoItem[];
  categorias: CatalogoItem[];
  subcategorias: Subcategoria[];
  general: number;
};
const emptyScope = (): ContextoDescuentoCliente => ({ id_marca: null, id_categoria: null, id_subcategoria: null });
const money = (value: number) => value.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
const decimal = (value: string) => Number(value.replace(",", "."));
const inputClass = "h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

export function ClienteDiscountRules({ value, onChange, onDraftChange, marcas, categorias, subcategorias, general }: Props) {
  const editorId = useId();
  const [scope, setScope] = useState(emptyScope);
  const [rate, setRate] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [simulation, setSimulation] = useState(emptyScope);
  const [amount, setAmount] = useState("");
  const hasDraft = editing !== null || rate !== "" || Object.values(scope).some((id) => id !== null);

  useEffect(() => { onDraftChange(hasDraft); }, [hasDraft, onDraftChange]);

  const selectScope = (current: ContextoDescuentoCliente, set: (value: ContextoDescuentoCliente) => void, field: keyof ContextoDescuentoCliente, text: string) => {
    const id = text ? Number(text) : null;
    if (field === "id_categoria") set({ ...current, id_categoria: id, id_subcategoria: null });
    else if (field === "id_subcategoria") set({ ...current, id_subcategoria: id, id_categoria: id ? subcategorias.find((item) => item.id === id)!.id_categoria : current.id_categoria });
    else set({ ...current, [field]: id });
  };
  const selectors = (current: ContextoDescuentoCliente, set: (value: ContextoDescuentoCliente) => void, prefix: string) => (
    <>
      <label className="min-w-0 space-y-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">Marca<select aria-label={`${prefix} marca`} className={inputClass} value={current.id_marca ?? ""} onChange={(event) => selectScope(current, set, "id_marca", event.target.value)}><option value="">Todas las marcas</option>{marcas.map((item) => <option key={item.id} value={item.id}>{item.descripcion}</option>)}</select></label>
      <label className="min-w-0 space-y-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">Categoría<select aria-label={`${prefix} categoría`} className={inputClass} value={current.id_categoria ?? ""} onChange={(event) => selectScope(current, set, "id_categoria", event.target.value)}><option value="">Todas las categorías</option>{categorias.map((item) => <option key={item.id} value={item.id}>{item.descripcion}</option>)}</select></label>
      <label className="min-w-0 space-y-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">Subcategoría<select aria-label={`${prefix} subcategoría`} className={inputClass} value={current.id_subcategoria ?? ""} onChange={(event) => selectScope(current, set, "id_subcategoria", event.target.value)}><option value="">Todas las subcategorías</option>{subcategorias.filter((item) => !current.id_categoria || item.id_categoria === current.id_categoria).map((item) => <option key={item.id} value={item.id}>{item.descripcion}</option>)}</select></label>
    </>
  );
  const reset = () => { setScope(emptyScope()); setRate(""); setEditing(null); setError(""); };
  const save = () => {
    const descuento = decimal(rate);
    if (!rate.trim() || !Number.isFinite(descuento) || descuento < 0 || descuento > 100 || Math.abs(descuento * 100 - Math.round(descuento * 100)) > 1e-7) { setError("El descuento debe estar entre 0 y 100%, con hasta dos decimales."); return; }
    if (Object.values(scope).every((value) => value === null)) { setError("Seleccioná al menos una marca, categoría o subcategoría para la regla."); return; }
    const next = { ...scope, descuento };
    if (value.some((rule, index) => index !== editing && claveReglaCliente(rule) === claveReglaCliente(next))) { setError("Ya hay una regla para esta combinación. Editá la regla existente para cambiar su descuento."); return; }
    if (editing === null && value.length >= 500) { setError("Se permiten hasta 500 reglas por cliente. Editá o eliminá una regla existente."); return; }
    onChange(editing === null ? [...value, next] : value.map((rule, index) => index === editing ? next : rule));
    reset();
  };
  const validGeneral = Number.isFinite(general) && general >= 0 && general <= 100;
  const resolved = resolverDescuentoCliente(value, simulation, validGeneral ? general : 0);
  const base = decimal(amount);
  const validAmount = validGeneral && Number.isFinite(base) && base > 0 && base <= 1e11;
  const applied = resolved.regla ? [marcas.find((item) => item.id === resolved.regla!.id_marca)?.descripcion,
    categorias.find((item) => item.id === resolved.regla!.id_categoria)?.descripcion,
    subcategorias.find((item) => item.id === resolved.regla!.id_subcategoria)?.descripcion].filter(Boolean).join(" / ") : "Bonificación general";
  const scopeLabel = (items: CatalogoItem[], id: number | null) => id === null ? "Todas" : items.find((item) => item.id === id)?.descripcion ?? `No disponible (#${id})`;

  return (
    <div className="space-y-5">
      <section aria-labelledby={`${editorId}-title`} className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id={`${editorId}-title`} className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">Reglas de descuento</h3>
          <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{value.length} / 500 reglas</span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">Definí descuentos por marca, categoría, subcategoría o sus combinaciones. Los descuentos no se acumulan.</p>
        <div className={`space-y-3 rounded-lg border p-3 ${editing === null ? "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40" : "border-blue-300 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20"}`}>
          <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{editing === null ? "Agregar una regla" : `Editando regla ${editing + 1}`}</p>
          <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_100px]" onChange={() => setError("")}>
            {selectors(scope, setScope, "Regla")}
            <label className="space-y-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">Descuento (%)<input aria-label="Descuento de la regla" inputMode="decimal" value={rate} onChange={(event) => setRate(event.target.value)} className={inputClass} /></label>
          </div>
          {error && <p role="alert" className="text-xs font-semibold text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={save} className="inline-flex h-9 items-center gap-1 rounded-md bg-blue-600 px-3 text-xs font-bold text-white hover:bg-blue-500">{editing === null ? <HiPlus className="h-4 w-4" /> : <HiCheck className="h-4 w-4" />}{editing === null ? "Agregar regla" : "Aceptar cambios"}</button>
            {hasDraft && <button type="button" onClick={reset} className="inline-flex h-9 items-center gap-1 rounded-md px-3 text-xs font-bold text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800"><HiX className="h-4 w-4" />{editing === null ? "Descartar borrador" : "Cancelar edición"}</button>}
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Se guardan al guardar el cliente.</span>
          </div>
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table aria-label="Reglas de descuento del cliente" className="w-full min-w-[580px] text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-900">
              <tr><th scope="col" className="px-3 py-2">Marca</th><th scope="col" className="px-3 py-2">Categoría</th><th scope="col" className="px-3 py-2">Subcategoría</th><th scope="col" className="px-3 py-2 text-right">Descuento</th><th scope="col" className="w-24 px-3 py-2 text-right">Acciones</th></tr>
            </thead>
            <tbody>
              {value.map((rule, index) => (
                <tr key={claveReglaCliente(rule)} className={`border-b border-slate-100 text-slate-700 last:border-0 dark:border-slate-800 dark:text-slate-200 ${editing === index ? "bg-blue-50 dark:bg-blue-950/30" : ""}`}>
                  <td className="px-3 py-2">{scopeLabel(marcas, rule.id_marca)}</td>
                  <td className="px-3 py-2">{scopeLabel(categorias, rule.id_categoria)}</td>
                  <td className="px-3 py-2">{scopeLabel(subcategorias, rule.id_subcategoria)}</td>
                  <td className="px-3 py-2 text-right font-mono font-bold">{rule.descuento.toLocaleString("es-AR")}%</td>
                  <td className="whitespace-nowrap px-3 py-1 text-right">
                    <button type="button" title="Editar regla" aria-label={`Editar regla ${index + 1}`} onClick={() => { setScope({ id_marca: rule.id_marca, id_categoria: rule.id_categoria, id_subcategoria: rule.id_subcategoria }); setRate(String(rule.descuento)); setEditing(index); setError(""); document.getElementById(`${editorId}-title`)?.scrollIntoView({ block: "start", behavior: "smooth" }); }} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/40 dark:hover:text-blue-300"><HiPencil className="h-4 w-4" /></button>
                    <button type="button" title="Quitar regla" aria-label={`Quitar regla ${index + 1}`} onClick={() => { onChange(value.filter((_, itemIndex) => itemIndex !== index)); reset(); }} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40 dark:hover:text-red-300"><HiTrash className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
              {!value.length && <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500 dark:text-slate-400">Sin reglas especiales. Se utiliza la bonificación general.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <details className="group rounded-lg border border-slate-200 dark:border-slate-800">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-3 text-xs font-bold text-slate-700 dark:text-slate-200">Simular precio<HiChevronDown className="h-4 w-4 transition group-open:rotate-180" /></summary>
        <div className="space-y-3 border-t border-slate-200 p-3 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">Comprobá qué descuento se aplica con las condiciones actuales de la ficha.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {selectors(simulation, setSimulation, "Simular")}
            <label className="space-y-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">Precio de lista (ARS)<input aria-label="Precio de lista para simular" inputMode="decimal" className={inputClass} value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
          </div>
          {!validGeneral && <p className="text-xs text-red-600 dark:text-red-400">Corregí la bonificación general para simular el precio.</p>}
          {amount.trim() && (!Number.isFinite(base) || base <= 0 || base > 1e11) && <p className="text-xs text-red-600 dark:text-red-400">Ingresá un precio de lista mayor que 0 y de hasta 100.000.000.000 ARS.</p>}
          <dl aria-live="polite" className="grid gap-3 rounded-md bg-slate-50 p-3 text-xs dark:bg-slate-900 sm:grid-cols-3">
            <div><dt className="text-slate-500">Regla aplicada</dt><dd className="mt-1 font-bold text-slate-800 dark:text-white">{validGeneral ? applied : "—"}</dd></div>
            <div><dt className="text-slate-500">Descuento</dt><dd className="mt-1 font-bold text-slate-800 dark:text-white">{validGeneral ? `${resolved.descuento.toLocaleString("es-AR")}%` : "—"}</dd></div>
            <div><dt className="text-slate-500">Precio final</dt><dd className="mt-1 font-black text-emerald-700 dark:text-emerald-300">{validAmount ? money(calcularPrecioCliente(base, resolved.descuento)) : "—"}</dd></div>
          </dl>
        </div>
      </details>
    </div>
  );
}
