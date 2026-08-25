"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HiArrowLeft, HiSave } from "react-icons/hi";

import { ProveedorImportHistory } from "@/components/proveedores/ProveedorImportHistory";
import { ProveedorImportSection } from "@/components/proveedores/ProveedorImportSection";
import type { CatalogoItem } from "@/interfaces/productos";

type Props = {
  proveedor: CatalogoItem;
};

export function ProveedorEditPage({ proveedor }: Props) {
  const router = useRouter();
  const [descripcion, setDescripcion] = useState(proveedor.descripcion.toUpperCase());
  const [documento, setDocumento] = useState((proveedor.documento ?? "").toUpperCase());
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (saving) return;

    try {
      setSaving(true);

      const response = await fetch(`/api/catalogos/proveedores/${proveedor.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descripcion, documento }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "No se pudo guardar el proveedor");
      }

      toast.success("Proveedor guardado correctamente");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar el proveedor");
    } finally {
      setSaving(false);
    }
  }, [descripcion, documento, proveedor.id, router, saving]);

  const sectionClass = "rounded-2xl border border-slate-800 bg-[#0f172a] p-4 shadow-sm";
  const labelClass = "text-[10px] font-black uppercase tracking-widest text-blue-400";
  const inputClass = "h-10 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 text-xs font-black uppercase text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10";

  return (
    <div className="min-h-screen px-4 py-5 md:px-6">
      <div className="mx-auto w-full max-w-[1500px]">
        <div className="mb-3">
          <Link
            href="/proveedores"
            className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500 transition hover:text-blue-500 dark:text-slate-400"
          >
            <HiArrowLeft className="h-4 w-4" />
            Volver a proveedores
          </Link>
        </div>

        <header className="mb-4 flex items-center justify-between rounded-2xl border border-slate-800 bg-[#0f172a] p-4 shadow-sm">
          <div className="min-w-0">
            <h1 className="truncate text-base font-black text-white">Editar proveedor</h1>
            <p className="truncate text-[11px] font-bold uppercase tracking-wider text-slate-500">{proveedor.descripcion}</p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 disabled:opacity-60 active:scale-95"
          >
            <HiSave className="h-4 w-4" />
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </header>

        <section className={sectionClass}>
          <h2 className="mb-3 text-[11px] font-black uppercase tracking-widest text-white">Informacion general</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className={labelClass}>Nombre</label>
              <input
                type="text"
                value={descripcion}
                onChange={(event) => setDescripcion(event.target.value.toUpperCase())}
                className={inputClass}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>CUIT / DNI</label>
              <input
                type="text"
                value={documento}
                onChange={(event) => setDocumento(event.target.value.toUpperCase())}
                className={inputClass}
                placeholder="CUIT o DNI"
              />
            </div>
          </div>
        </section>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section className={sectionClass}>
            <h2 className="mb-3 text-[11px] font-black uppercase tracking-widest text-white">Importar lista de precios</h2>
            <ProveedorImportSection id_proveedor={proveedor.id} nombre_proveedor={descripcion} hideHistory compact />
          </section>

          <section className={sectionClass}>
            <h2 className="mb-3 text-[11px] font-black uppercase tracking-widest text-white">Ultimas importaciones</h2>
            <ProveedorImportHistory id_proveedor={proveedor.id} compact />
          </section>
        </div>
      </div>
    </div>
  );
}
