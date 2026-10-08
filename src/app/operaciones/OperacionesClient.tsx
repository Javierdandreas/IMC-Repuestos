"use client";

import { useState } from "react";
import useSWR from "swr";
import { useRouter, useSearchParams } from "next/navigation";
import { HiEye, HiPlus } from "react-icons/hi";
import { AnimatePresence } from "framer-motion";
import { OperacionListado } from "@/interfaces/operaciones";
import { NuevaOperacionWizard } from "@/components/operaciones/NuevaOperacionWizard";
import { OperacionDetailModal } from "@/components/operaciones/OperacionDetailModal";

type OperationType = "COMPRA" | "VENTA" | "AJUSTE";

const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "No se pudieron cargar las operaciones.");
  return data as OperacionListado[];
};

const viewConfig: Record<OperationType, { title: string; singular: string; subtitle: string; tone: string }> = {
  VENTA: { title: "Ventas", singular: "Venta", subtitle: "Comprobantes de venta registrados.", tone: "text-blue-600 dark:text-blue-300" },
  COMPRA: { title: "Compras", singular: "Compra", subtitle: "Comprobantes de compra registrados.", tone: "text-emerald-600 dark:text-emerald-300" },
  AJUSTE: { title: "Ajustes de stock", singular: "Ajuste", subtitle: "Movimientos manuales que modifican el stock.", tone: "text-amber-600 dark:text-amber-300" },
};

function formatMoney(value: number | string | null | undefined) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 }).format(Number(value) || 0);
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function statusClass(status: OperacionListado["estado"]) {
  if (status === "CONFIRMADA") return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (status === "ANULADA") return "bg-red-500/10 text-red-700 dark:text-red-300";
  return "bg-amber-500/10 text-amber-700 dark:text-amber-300";
}

export function OperacionesClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const requestedType = searchParams.get("tipo") as OperationType | null;
  const type: OperationType = requestedType === "COMPRA" || requestedType === "AJUSTE" || requestedType === "VENTA" ? requestedType : "VENTA";
  const config = viewConfig[type];
  const { data, error, isLoading, mutate } = useSWR<OperacionListado[]>(`/api/operaciones?tipo=${type}`, fetcher);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedOperacion, setSelectedOperacion] = useState<number | string | null>(null);

  const createOperation = () => {
    if (type === "COMPRA") {
      router.push("/operaciones/compras/nueva");
      return;
    }
    setWizardOpen(true);
  };

  return (
    <main className="min-h-[calc(100dvh-7rem)] bg-white p-4 dark:bg-black md:p-6">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">{config.title}</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">{config.subtitle}</p>
          </div>
          <button type="button" onClick={createOperation} className="inline-flex h-11 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-black text-white transition hover:bg-slate-700 dark:bg-blue-600 dark:hover:bg-blue-500">
            <HiPlus className="h-5 w-5" /> Nueva {config.singular}
          </button>
        </header>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/40">
            <p className="text-xs font-bold text-slate-500">{(data?.length ?? 0).toLocaleString("es-AR")} {config.title.toLowerCase()}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:bg-slate-900/60">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-3 py-3">Comprobante</th>
                  <th className="px-3 py-3">{type === "COMPRA" ? "Proveedor" : type === "VENTA" ? "Cliente" : "Responsable"}</th>
                  <th className="px-3 py-3 text-right">Items</th>
                  <th className="px-3 py-3 text-right">Unidades</th>
                  <th className="px-3 py-3 text-right">Total</th>
                  <th className="px-3 py-3">Estado</th>
                  <th className="px-3 py-3">Creado por</th>
                  <th className="w-14 px-3 py-3 text-center">Ver</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {isLoading && <tr><td colSpan={9} className="px-4 py-14 text-center font-bold text-slate-500">Cargando {config.title.toLowerCase()}...</td></tr>}
                {error && <tr><td colSpan={9} className="px-4 py-14 text-center font-bold text-red-600 dark:text-red-300">{error.message}</td></tr>}
                {!isLoading && !error && data?.length === 0 && <tr><td colSpan={9} className="px-4 py-14 text-center font-bold text-slate-500">No hay {config.title.toLowerCase()} registradas.</td></tr>}
                {!isLoading && !error && data?.map((operation) => {
                  const entity = operation.proveedor || operation.entidad_nombre || (type === "AJUSTE" ? "Ajuste interno" : "Sin asignar");
                  return (
                    <tr key={operation.id} className="cursor-pointer text-slate-700 transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900/60" onClick={() => setSelectedOperacion(operation.id)}>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-[10px] font-semibold text-slate-500">{formatDate(operation.fecha_operacion || operation.created_at)}</td>
                      <td className="px-3 py-3"><p className="font-mono font-black text-slate-900 dark:text-white">{operation.numero_comprobante || "INTERNO"}</p><p className="mt-1 text-[10px] text-slate-400">{operation.tipo_comprobante || config.singular}</p></td>
                      <td className="max-w-72 truncate px-3 py-3 font-semibold" title={entity}>{entity}</td>
                      <td className="px-3 py-3 text-right font-mono font-bold">{Number(operation.cantidad_items || 0)}</td>
                      <td className={`px-3 py-3 text-right font-mono font-black ${type === "AJUSTE" && Number(operation.total_unidades) < 0 ? "text-red-600 dark:text-red-300" : config.tone}`}>{Number(operation.total_unidades || 0).toLocaleString("es-AR")}</td>
                      <td className="px-3 py-3 text-right font-mono font-black text-slate-900 dark:text-white">{formatMoney(operation.total)}</td>
                      <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-wide ${statusClass(operation.estado)}`}>{operation.estado}</span></td>
                      <td className="max-w-40 truncate px-3 py-3 text-[11px] font-semibold text-slate-500" title={operation.creador}>{operation.creador || "-"}</td>
                      <td className="px-3 py-3 text-center"><button type="button" title="Ver detalle" aria-label={`Ver detalle de ${operation.numero_comprobante || operation.id}`} onClick={(event) => { event.stopPropagation(); setSelectedOperacion(operation.id); }} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-blue-600 transition hover:bg-blue-500/10 dark:text-blue-300"><HiEye className="h-4 w-4" /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <AnimatePresence>
        {wizardOpen && <NuevaOperacionWizard tipo={type} onClose={() => { setWizardOpen(false); void mutate(); }} />}
        {selectedOperacion && <OperacionDetailModal operacionId={selectedOperacion} onClose={() => setSelectedOperacion(null)} />}
      </AnimatePresence>
    </main>
  );
}
