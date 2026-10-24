"use client";

import { useCallback, useEffect, useState } from "react";
import { Database, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type Estado = {
  estado: string;
  siguiente_marca: number;
  total_marcas: number;
  ultimo_error: string | null;
  atributos: Array<{ id: string; nombre: string; grupo: string; total: number; habilitado: boolean }>;
};

export function CatalogoVehiculosMercadoLibrePage({ canManage }: { canManage: boolean }) {
  const [data, setData] = useState<Estado | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/compatibilidades", { cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "No se pudo consultar el catalogo.");
      setData(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo consultar el catalogo.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const sync = async () => {
    try {
      setSyncing(true);
      const response = await fetch("/api/compatibilidades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reiniciar: data?.estado === "COMPLETADA" }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "No se pudo actualizar el catalogo.");
      toast.success(result.completada ? "Catalogo de marcas y modelos actualizado." : `Se guardaron modelos de ${result.consultadas} marcas. Continua para seguir.`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar el catalogo.");
      await load();
    } finally {
      setSyncing(false);
    }
  };

  const progress = data?.total_marcas ? Math.min(100, Math.round((data.siguiente_marca / data.total_marcas) * 100)) : 0;
  const canContinue = data?.estado === "EN_PROCESO" || data?.estado === "ERROR";

  return <div className="space-y-5">
    <section className="border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-300"><Database className="h-5 w-5" /></span>
          <div><h1 className="text-lg font-black text-slate-900 dark:text-white">Catalogo de vehiculos de Mercado Libre</h1><p className="mt-1 max-w-3xl text-sm text-slate-500">Argentina - MLA-CARS_AND_VANS. Se conservan los IDs oficiales y los nombres para usarlos al asignar aplicaciones a una pieza.</p></div>
        </div>
        {canManage && <button type="button" onClick={() => void sync()} disabled={syncing} className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-xs font-black text-white hover:bg-blue-500 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />{syncing ? "Consultando..." : canContinue ? "Continuar carga" : "Actualizar catalogo"}</button>}
      </div>
      <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-800">
        <div className="flex items-center justify-between gap-3 text-xs font-bold"><span>Marcas y modelos: {data?.siguiente_marca ?? 0} de {data?.total_marcas ?? 0}</span><span>{progress}%</span></div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} /></div>
        <p className="mt-3 text-xs text-slate-500">La carga trabaja por tramos para respetar el limite de Mercado Libre. Los anos, versiones, motores y especificaciones se consultan con el vehiculo elegido y quedan guardados para las siguientes piezas.</p>
        {data?.ultimo_error && <p className="mt-3 text-xs font-semibold text-red-600 dark:text-red-300">{data.ultimo_error}</p>}
      </div>
    </section>
    <section className="border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800"><h2 className="text-sm font-black text-slate-900 dark:text-white">Valores guardados por atributo</h2></div>
      <div className="grid divide-y divide-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4 dark:divide-slate-800">
        {loading ? <p className="col-span-full p-8 text-center text-sm text-slate-500">Cargando catalogo...</p> : data?.atributos.filter((attribute) => attribute.habilitado).map((attribute) => <div key={attribute.id} className="p-4"><p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{attribute.grupo}</p><p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{attribute.nombre}</p><p className="mt-2 font-mono text-xl font-black text-blue-600 dark:text-blue-300">{attribute.total.toLocaleString("es-AR")}</p></div>)}
      </div>
    </section>
  </div>;
}
