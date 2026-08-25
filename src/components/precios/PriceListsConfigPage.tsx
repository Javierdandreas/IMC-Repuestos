"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Check, DollarSign, Eye, EyeOff, Percent, Plus, Save, Trash2 } from "lucide-react";
import { usePermissions } from "@/components/auth/usePermissions";
import { useAppError } from "@/context/AppErrorContext";
import { useMetadata } from "@/context/MetadataContext";
import type { TipoPrecio } from "@/interfaces/productos";

type EditableTipoPrecio = {
  id: number;
  descripcion: string;
  margen_default: number;
  activo: boolean;
  orden: number | null;
};

const toEditable = (item: TipoPrecio): EditableTipoPrecio => ({
  id: item.id,
  descripcion: item.descripcion,
  margen_default: Number(item.margen_default ?? 0),
  activo: item.activo !== false,
  orden: item.orden ?? item.id,
});

export function PriceListsConfigPage() {
  const router = useRouter();
  const { canManage } = usePermissions();
  const { showError } = useAppError();
  const { tiposPrecio, refresh } = useMetadata();
  const [items, setItems] = useState<EditableTipoPrecio[]>(() => tiposPrecio.map(toEditable));
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    setItems(tiposPrecio.map(toEditable));
  }, [tiposPrecio]);

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => (a.orden ?? a.id) - (b.orden ?? b.id)),
    [items]
  );

  const costo = sortedItems.find((item) => item.descripcion.trim().toUpperCase() === "PRECIO COSTO");
  const listasVenta = sortedItems.filter((item) => item.id !== costo?.id);
  const activeCount = listasVenta.filter((item) => item.activo).length;

  const updateItem = (id: number, patch: Partial<EditableTipoPrecio>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await fetch("/api/tipos-precio", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "No se pudieron guardar las listas de precio");

      setItems(data.map(toEditable));
      await refresh();
      toast.success("Listas de precio guardadas");
    } catch (error) {
      showError(error, "No se pudieron guardar las listas de precio");
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    try {
      setCreating(true);
      const nextNumber = items.filter((item) => item.descripcion.startsWith("NUEVA LISTA")).length + 1;
      const descripcion = nextNumber === 1 ? "NUEVA LISTA" : `NUEVA LISTA ${nextNumber}`;
      const response = await fetch("/api/tipos-precio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descripcion, margen_default: 0, activo: true }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "No se pudo crear la lista de precio");

      setItems((prev) => [...prev, toEditable(data)]);
      await refresh();
      toast.success("Lista de precio creada");
    } catch (error) {
      showError(error, "No se pudo crear la lista de precio");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (item: EditableTipoPrecio) => {
    const confirmed = window.confirm(`¿Eliminar la lista "${item.descripcion}"? Si ya tiene precios cargados, el sistema te pedira ocultarla en lugar de borrarla.`);
    if (!confirmed) return;

    try {
      setDeletingId(item.id);
      const response = await fetch(`/api/tipos-precio/${item.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "No se pudo eliminar la lista de precio");

      setItems((prev) => prev.filter((current) => current.id !== item.id));
      await refresh();
      toast.success("Lista de precio eliminada");
    } catch (error) {
      showError(error, "No se pudo eliminar la lista de precio");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 dark:bg-slate-950 md:p-6">
      <div className="flex w-full flex-col gap-4">
        <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/45 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="mb-3 inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 transition hover:text-slate-900 dark:hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver a items
            </button>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">Listas de precio</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Configurá nombres, visibilidad y margen sugerido para calcular precios desde el costo.
            </p>
          </div>

          {canManage && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-5 text-xs font-black uppercase tracking-widest text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                <Plus className="h-4 w-4" />
                {creating ? "Creando" : "Nueva lista"}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-xs font-black uppercase tracking-widest text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {saving ? "Guardando" : "Guardar"}
              </button>
            </div>
          )}
        </header>

        <main className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/45">
            <div className="mb-4 border-b border-slate-200 pb-3 dark:border-slate-800">
              <h2 className="text-sm font-black text-slate-900 dark:text-white">Configuración</h2>
              <p className="mt-1 text-xs font-medium text-slate-500">
                El margen es un valor por defecto para nuevos cálculos. No modifica precios ya guardados.
              </p>
            </div>

            <div className="hidden grid-cols-[minmax(170px,1fr)_140px_120px_44px] gap-3 border-b border-slate-200 px-3 pb-2 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:border-slate-800 md:grid">
              <span>Lista</span>
              <span>Margen</span>
              <span>Estado</span>
              <span />
            </div>

            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {sortedItems.map((item) => {
                const isCosto = item.id === costo?.id;
                return (
                  <div key={item.id} className="grid grid-cols-1 gap-3 px-3 py-3 md:grid-cols-[minmax(170px,1fr)_140px_120px_44px] md:items-center">
                    <label className="flex flex-col gap-1">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 md:hidden">Lista</span>
                      <input
                        type="text"
                        value={item.descripcion}
                        disabled={!canManage || isCosto}
                        onChange={(event) => updateItem(item.id, { descripcion: event.target.value.toUpperCase() })}
                        className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-black uppercase tracking-wide text-slate-900 outline-none transition focus:border-blue-500 disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                      />
                    </label>

                    <label className="relative flex flex-col gap-1">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 md:hidden">Margen</span>
                      <Percent className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 translate-y-1 text-slate-400 md:translate-y-[-50%]" />
                      <input
                        type="number"
                        value={item.margen_default}
                        disabled={!canManage || isCosto}
                        onChange={(event) => updateItem(item.id, { margen_default: Number(event.target.value || 0) })}
                        className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 pr-9 text-xs font-bold text-slate-900 outline-none transition focus:border-blue-500 disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                      />
                    </label>

                    <button
                      type="button"
                      disabled={!canManage || isCosto}
                      onClick={() => updateItem(item.id, { activo: !item.activo })}
                      className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-[10px] font-black uppercase tracking-widest transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        item.activo
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                          : "border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-950"
                      }`}
                    >
                      {item.activo ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      {item.activo ? "Activa" : "Oculta"}
                    </button>

                    <button
                      type="button"
                      disabled={!canManage || isCosto || deletingId === item.id}
                      onClick={() => handleDelete(item)}
                      className="inline-flex h-10 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-500 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-40"
                      title={isCosto ? "La lista de costo no se puede eliminar" : "Eliminar lista"}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/45 xl:sticky xl:top-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Resumen</p>
            <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-1">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                <DollarSign className="mb-2 h-4 w-4 text-blue-500" />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Listas activas</p>
                <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{activeCount}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                <Check className="mb-2 h-4 w-4 text-emerald-500" />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Costo</p>
                <p className="mt-1 text-sm font-black text-slate-900 dark:text-white">{costo?.descripcion || "PRECIO COSTO"}</p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
              Si una lista ya fue usada en items, ocultala para no perder historial de precios.
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}
