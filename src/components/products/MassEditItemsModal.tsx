"use client";

import { useEffect, useMemo, useState } from "react";
import { HiCheck, HiRefresh } from "react-icons/hi";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";
import { useAppError } from "@/context/AppErrorContext";
import type { ItemListadoUnificado } from "@/lib/repos/items-unificados";

type Campo = "CLASIFICACION" | "MARCA" | "PROVEEDOR" | "UBICACION" | "STOCK_MINIMO" | "OBSERVACION" | "PALABRAS_CLAVE";

type Props = {
  open: boolean;
  onClose: () => void;
  items: ItemListadoUnificado[];
  categorias: { id: number; descripcion: string }[];
  subcategorias: { id: number; descripcion: string; id_categoria: number }[];
  marcas: { id: number; descripcion: string }[];
  proveedores: { id: number; descripcion: string }[];
  ubicaciones: { id: number; descripcion: string }[];
  onSuccess: () => void;
};

const CAMPOS: Array<{ value: Campo; label: string; aplica: string }> = [
  { value: "CLASIFICACION", label: "Categoria y subcategoria", aplica: "Items y kits" },
  { value: "MARCA", label: "Marca", aplica: "Items y kits" },
  { value: "PROVEEDOR", label: "Proveedor", aplica: "Solo items" },
  { value: "UBICACION", label: "Ubicacion", aplica: "Solo items" },
  { value: "STOCK_MINIMO", label: "Stock minimo", aplica: "Items y kits" },
  { value: "OBSERVACION", label: "Observacion", aplica: "Items y kits" },
  { value: "PALABRAS_CLAVE", label: "Palabras clave", aplica: "Solo items" },
];

export function MassEditItemsModal({
  open,
  onClose,
  items,
  categorias,
  subcategorias,
  marcas,
  proveedores,
  ubicaciones,
  onSuccess,
}: Props) {
  const { showError } = useAppError();
  const [campo, setCampo] = useState<Campo>("CLASIFICACION");
  const [idCategoria, setIdCategoria] = useState("");
  const [idSubcategoria, setIdSubcategoria] = useState("");
  const [valor, setValor] = useState("");
  const [texto, setTexto] = useState("");
  const [stockMinimo, setStockMinimo] = useState("0");
  const [saving, setSaving] = useState(false);

  const totalItems = items.filter((item) => item.tipo === "ITEM").length;
  const totalKits = items.length - totalItems;
  const soloItems = campo === "PROVEEDOR" || campo === "UBICACION" || campo === "PALABRAS_CLAVE";
  const subcategoriasDisponibles = useMemo(
    () => subcategorias.filter((item) => String(item.id_categoria) === idCategoria),
    [idCategoria, subcategorias],
  );

  useEffect(() => {
    if (!open) return;
    setCampo("CLASIFICACION");
    setIdCategoria("");
    setIdSubcategoria("");
    setValor("");
    setTexto("");
    setStockMinimo("0");
  }, [open]);

  const labelCampo = CAMPOS.find((item) => item.value === campo)?.label.toLowerCase() || "cambio";

  const submit = async () => {
    if (campo === "CLASIFICACION" && (!idCategoria || !idSubcategoria)) {
      toast.error("Selecciona categoria y subcategoria");
      return;
    }
    if (["MARCA", "PROVEEDOR", "UBICACION"].includes(campo) && !valor) {
      toast.error("Selecciona un valor");
      return;
    }
    if (campo === "STOCK_MINIMO" && (!/^\d+$/.test(stockMinimo) || Number(stockMinimo) < 0)) {
      toast.error("Ingresa un stock minimo valido");
      return;
    }
    if (!window.confirm(`Se aplicara ${labelCampo} a ${items.length} seleccionados.${soloItems && totalKits > 0 ? ` ${totalKits} kit(s) no se modificaran.` : ""}\n\nContinuar?`)) return;

    try {
      setSaving(true);
      const response = await fetch("/api/items/cambio-masivo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({ id: item.id, tipo: item.tipo })),
          campo,
          idCategoria: idCategoria ? Number(idCategoria) : undefined,
          idSubcategoria: idSubcategoria ? Number(idSubcategoria) : undefined,
          idMarca: campo === "MARCA" ? Number(valor) : undefined,
          idProveedor: campo === "PROVEEDOR" ? Number(valor) : undefined,
          idUbicacion: campo === "UBICACION" ? Number(valor) : undefined,
          stockMinimo: campo === "STOCK_MINIMO" ? Number(stockMinimo) : undefined,
          texto: ["OBSERVACION", "PALABRAS_CLAVE"].includes(campo) ? texto : undefined,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "No se pudo aplicar el cambio");
      toast.success("Cambio masivo aplicado");
      onSuccess();
      onClose();
    } catch (error) {
      showError(error, "No se pudo aplicar el cambio masivo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Cambio masivo" width="w-full max-w-lg">
      <div className="space-y-5 p-5">
        <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <span className="rounded-md bg-blue-50 px-2.5 py-1 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">{items.length} seleccionados</span>
          {totalItems > 0 && <span>{totalItems} item{totalItems === 1 ? "" : "s"}</span>}
          {totalKits > 0 && <span>{totalKits} kit{totalKits === 1 ? "" : "s"}</span>}
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-black uppercase tracking-wide text-slate-500">Modificar</span>
          <select value={campo} onChange={(event) => { setCampo(event.target.value as Campo); setValor(""); }} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
            {CAMPOS.map((item) => <option key={item.value} value={item.value}>{item.label} ({item.aplica})</option>)}
          </select>
        </label>

        {campo === "CLASIFICACION" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5"><span className="text-[11px] font-black uppercase tracking-wide text-slate-500">Categoria</span><select value={idCategoria} onChange={(event) => { setIdCategoria(event.target.value); setIdSubcategoria(""); }} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"><option value="">Seleccionar</option>{categorias.map((item) => <option key={item.id} value={item.id}>{item.descripcion}</option>)}</select></label>
            <label className="flex flex-col gap-1.5"><span className="text-[11px] font-black uppercase tracking-wide text-slate-500">Subcategoria</span><select value={idSubcategoria} disabled={!idCategoria} onChange={(event) => setIdSubcategoria(event.target.value)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white"><option value="">Seleccionar</option>{subcategoriasDisponibles.map((item) => <option key={item.id} value={item.id}>{item.descripcion}</option>)}</select></label>
          </div>
        )}

        {campo === "MARCA" && <Selector label="Marca" value={valor} onChange={setValor} options={marcas} />}
        {campo === "PROVEEDOR" && <Selector label="Proveedor" value={valor} onChange={setValor} options={proveedores} />}
        {campo === "UBICACION" && <Selector label="Ubicacion" value={valor} onChange={setValor} options={ubicaciones} />}
        {campo === "STOCK_MINIMO" && <label className="flex flex-col gap-1.5"><span className="text-[11px] font-black uppercase tracking-wide text-slate-500">Stock minimo</span><input type="number" min="0" step="1" value={stockMinimo} onChange={(event) => setStockMinimo(event.target.value)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" /></label>}
        {["OBSERVACION", "PALABRAS_CLAVE"].includes(campo) && (
          <label className="flex flex-col gap-1.5"><span className="text-[11px] font-black uppercase tracking-wide text-slate-500">{campo === "OBSERVACION" ? "Observacion" : "Palabras clave"}</span><textarea value={texto} onChange={(event) => setTexto(event.target.value)} rows={4} className="resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" /></label>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <button type="button" onClick={onClose} disabled={saving} className="h-10 rounded-lg px-4 text-sm font-bold text-slate-500 transition hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800">Cancelar</button>
          <button type="button" onClick={() => void submit()} disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
            {saving ? <HiRefresh className="h-4 w-4 animate-spin" /> : <HiCheck className="h-4 w-4" />} Aplicar cambios
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Selector({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ id: number; descripcion: string }> }) {
  return <label className="flex flex-col gap-1.5"><span className="text-[11px] font-black uppercase tracking-wide text-slate-500">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"><option value="">Seleccionar</option>{options.map((item) => <option key={item.id} value={item.id}>{item.descripcion}</option>)}</select></label>;
}
