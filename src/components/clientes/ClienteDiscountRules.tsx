"use client";

import { useState } from "react";
import { HiCheck, HiPencil, HiPlus, HiTrash, HiX } from "react-icons/hi";
import { toast } from "sonner";
import type { CatalogoItem, Subcategoria } from "@/interfaces/productos";
import { calcularPrecioCliente, claveReglaCliente, resolverDescuentoCliente, type ContextoDescuentoCliente, type ReglaDescuentoCliente } from "@/lib/descuentos-cliente";

type Props = {
  value: ReglaDescuentoCliente[]; onChange: (rules: ReglaDescuentoCliente[]) => void;
  marcas: CatalogoItem[]; categorias: CatalogoItem[]; subcategorias: Subcategoria[]; general: number;
};
const emptyScope = (): ContextoDescuentoCliente => ({ id_marca:null, id_categoria:null, id_subcategoria:null });
const money = (v: number) => v.toLocaleString("es-AR", {style:"currency",currency:"ARS"});
const decimal = (v: string) => Number(v.replace(",", "."));
const inputClass = "h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

export function ClienteDiscountRules({value, onChange, marcas, categorias, subcategorias, general}: Props) {
  const [scope, setScope] = useState(emptyScope);
  const [rate, setRate] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [simulation, setSimulation] = useState(emptyScope);
  const [amount, setAmount] = useState("");
  const selectScope = (current: ContextoDescuentoCliente, set: (v: ContextoDescuentoCliente) => void, field: keyof ContextoDescuentoCliente, text: string) => {
    const id = text ? Number(text) : null;
    if (field === "id_categoria") set({...current,id_categoria:id,id_subcategoria:null});
    else if (field === "id_subcategoria") set({...current,id_subcategoria:id,id_categoria:id ? subcategorias.find((s) => s.id===id)!.id_categoria : current.id_categoria});
    else set({...current,[field]:id});
  };
  const selectors = (current: ContextoDescuentoCliente, set: (v: ContextoDescuentoCliente) => void, prefix: string) => (
    <>
      <label className="min-w-0 space-y-1 text-[10px] font-bold text-slate-500">Marca<select aria-label={`${prefix} marca`} className={inputClass} value={current.id_marca ?? ""} onChange={(e) => selectScope(current,set,"id_marca",e.target.value)}><option value="">Todas las marcas</option>{marcas.map((m) => <option key={m.id} value={m.id}>{m.descripcion}</option>)}</select></label>
      <label className="min-w-0 space-y-1 text-[10px] font-bold text-slate-500">Categoria<select aria-label={`${prefix} categoria`} className={inputClass} value={current.id_categoria ?? ""} onChange={(e) => selectScope(current,set,"id_categoria",e.target.value)}><option value="">Todas las categorias</option>{categorias.map((c) => <option key={c.id} value={c.id}>{c.descripcion}</option>)}</select></label>
      <label className="min-w-0 space-y-1 text-[10px] font-bold text-slate-500">Subcategoria<select aria-label={`${prefix} subcategoria`} className={inputClass} value={current.id_subcategoria ?? ""} onChange={(e) => selectScope(current,set,"id_subcategoria",e.target.value)}><option value="">Todas las subcategorias</option>{subcategorias.filter((s) => !current.id_categoria || s.id_categoria===current.id_categoria).map((s) => <option key={s.id} value={s.id}>{s.descripcion}</option>)}</select></label>
    </>
  );
  const reset = () => {setScope(emptyScope());setRate("");setEditing(null);};
  const save = () => {
    const descuento = decimal(rate);
    if (!rate.trim() || !Number.isFinite(descuento) || descuento<0 || descuento>100 || Math.abs(descuento*100-Math.round(descuento*100))>1e-7) {toast.error("El descuento debe estar entre 0 y 100, con hasta dos decimales.");return;}
    if (Object.values(scope).every((v) => v===null)) {toast.error("Selecciona al menos una marca, categoria o subcategoria.");return;}
    const next = {...scope,descuento};
    if (value.some((r,i) => i!==editing && claveReglaCliente(r)===claveReglaCliente(next))) {toast.error("Ya hay una regla con ese alcance. Editala para cambiar el descuento.");return;}
    if (editing===null && value.length>=500) {toast.error("Se permiten hasta 500 reglas por cliente.");return;}
    onChange(editing===null ? [...value,next] : value.map((r,i) => i===editing ? next : r)); reset();
  };
  const validGeneral = Number.isFinite(general) && general>=0 && general<=100;
  const resolved = resolverDescuentoCliente(value,simulation,validGeneral ? general : 0);
  const base = decimal(amount);
  const validAmount = validGeneral && Number.isFinite(base) && base>0 && base<=1e11;
  const applied = resolved.regla ? [marcas.find((m) => m.id===resolved.regla!.id_marca)?.descripcion,
    categorias.find((c) => c.id===resolved.regla!.id_categoria)?.descripcion,
    subcategorias.find((s) => s.id===resolved.regla!.id_subcategoria)?.descripcion].filter(Boolean).join(" / ") : "Bonificacion general";

  return <div className="mt-5 space-y-5 border-t border-slate-200 pt-4 dark:border-slate-800">
    <h4 className="text-xs font-black text-slate-700 dark:text-slate-200">Descuentos especiales</h4>
    <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_100px_auto]">
      {selectors(scope,setScope,"Regla")}
      <label className="space-y-1 text-[10px] font-bold text-slate-500">Descuento %<input aria-label="Descuento de la regla" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} className={inputClass} /></label>
      <div className="flex gap-1"><button type="button" title={editing===null ? "Agregar regla" : "Aceptar regla"} onClick={save} className="inline-flex h-9 items-center gap-1 rounded-md border border-blue-600 px-3 text-xs font-bold text-blue-600 dark:text-blue-300">{editing===null ? <HiPlus /> : <HiCheck />}{editing===null ? "Agregar" : "Aceptar"}</button>{editing!==null && <button type="button" title="Cancelar edicion de regla" onClick={reset} className="h-9 w-9 text-slate-500"><HiX className="mx-auto h-4 w-4" /></button>}</div>
    </div>
    <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="border-b border-slate-200 text-[10px] uppercase text-slate-500 dark:border-slate-800"><tr><th className="py-2 pr-3">Marca</th><th className="pr-3">Categoria</th><th className="pr-3">Subcategoria</th><th className="pr-3 text-right">Descuento</th><th className="w-20 text-right">Acciones</th></tr></thead><tbody>{value.map((r,i) => <tr key={claveReglaCliente(r)} className="border-b border-slate-100 text-slate-700 dark:border-slate-800 dark:text-slate-200"><td className="py-2 pr-3">{marcas.find((m) => m.id===r.id_marca)?.descripcion ?? "Todas"}</td><td className="pr-3">{categorias.find((c) => c.id===r.id_categoria)?.descripcion ?? "Todas"}</td><td className="pr-3">{subcategorias.find((s) => s.id===r.id_subcategoria)?.descripcion ?? "Todas"}</td><td className="pr-3 text-right font-mono">{r.descuento.toLocaleString("es-AR")}%</td><td className="text-right"><button type="button" title="Editar regla" onClick={() => {setScope({id_marca:r.id_marca,id_categoria:r.id_categoria,id_subcategoria:r.id_subcategoria});setRate(String(r.descuento));setEditing(i);}} className="inline-flex h-8 w-8 items-center justify-center text-slate-500"><HiPencil /></button><button type="button" title="Quitar regla" onClick={() => {onChange(value.filter((_,index) => index!==i));reset();}} className="inline-flex h-8 w-8 items-center justify-center text-red-500"><HiTrash /></button></td></tr>)}{!value.length && <tr><td colSpan={5} className="py-4 text-slate-500">Sin reglas especiales.</td></tr>}</tbody></table></div>
    <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
      <h4 className="mb-3 text-xs font-black text-slate-700 dark:text-slate-200">Simular precio</h4>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{selectors(simulation,setSimulation,"Simular")}<label className="space-y-1 text-[10px] font-bold text-slate-500">Precio de lista (ARS)<input aria-label="Precio de lista para simular" inputMode="decimal" className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} /></label></div>
      <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-3"><div><dt className="text-slate-500">Regla aplicada</dt><dd className="mt-1 font-bold text-slate-800 dark:text-white">{applied}</dd></div><div><dt className="text-slate-500">Descuento</dt><dd className="mt-1 font-bold text-slate-800 dark:text-white">{resolved.descuento.toLocaleString("es-AR")}%</dd></div><div><dt className="text-slate-500">Precio final</dt><dd className="mt-1 font-black text-emerald-700 dark:text-emerald-300">{validAmount ? money(calcularPrecioCliente(base,resolved.descuento)) : "-"}</dd></div></dl>
    </div>
  </div>;
}
