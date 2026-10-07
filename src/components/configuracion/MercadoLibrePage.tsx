"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ExternalLink, Link2, RefreshCw, ShieldCheck, Unlink } from "lucide-react";
import { toast } from "sonner";

import type {
  MercadoLibreCuentaEstado,
  MercadoLibrePublicacionListado,
  MercadoLibrePublicacionesResult,
  MercadoLibreSyncResult,
} from "@/interfaces/mercadolibre";

type Props = { canManage: boolean };

function money(value: number | null, currency: string | null) {
  if (value === null) return "-";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: currency || "ARS", maximumFractionDigits: 2 }).format(value);
}

function date(value: string | null) {
  if (!value) return "Todavia no sincronizada";
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function linkBadge(tipo: MercadoLibrePublicacionListado["tipoVinculo"]) {
  if (tipo === "CODIGO_EXACTO") return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (tipo === "MANUAL") return "bg-blue-500/10 text-blue-700 dark:text-blue-300";
  return "bg-amber-500/10 text-amber-700 dark:text-amber-300";
}

export function MercadoLibrePage({ canManage }: Props) {
  const searchParams = useSearchParams();
  const [cuentas, setCuentas] = useState<MercadoLibreCuentaEstado[]>([]);
  const [publicaciones, setPublicaciones] = useState<MercadoLibrePublicacionesResult>({ data: [], totalCount: 0, totalPages: 0 });
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPublications = useCallback(async (accountId: number, currentPage = 1) => {
    const response = await fetch(`/api/integraciones/mercadolibre/publicaciones?idCuenta=${accountId}&page=${currentPage}`, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "No se pudieron cargar las publicaciones.");
    setPublicaciones(data);
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/integraciones/mercadolibre/estado", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "No se pudo cargar Mercado Libre.");
      const nextAccounts = data.cuentas as MercadoLibreCuentaEstado[];
      setCuentas(nextAccounts);
      const accountId = nextAccounts.some((account) => account.id === selectedAccountId) ? selectedAccountId : nextAccounts[0]?.id ?? null;
      setSelectedAccountId(accountId);
      setPage(1);
      if (accountId) await loadPublications(accountId, 1);
      else setPublicaciones({ data: [], totalCount: 0, totalPages: 0 });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo cargar Mercado Libre.");
    } finally {
      setLoading(false);
    }
  }, [loadPublications, selectedAccountId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (searchParams.get("meli") === "conectado") toast.success("Cuenta de Mercado Libre conectada.");
    if (searchParams.get("meli") === "error") toast.error(searchParams.get("mensaje") || "No se pudo conectar Mercado Libre.");
  }, [searchParams]);

  const selectAccount = async (accountId: number) => {
    setSelectedAccountId(accountId);
    setPage(1);
    try { await loadPublications(accountId, 1); } catch (requestError) { toast.error(requestError instanceof Error ? requestError.message : "No se pudieron cargar las publicaciones."); }
  };

  const sync = async () => {
    if (!selectedAccountId) return;
    try {
      setSyncing(true);
      const response = await fetch("/api/integraciones/mercadolibre/sincronizar", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idCuenta: selectedAccountId }),
      });
      const result = await response.json().catch(() => ({})) as MercadoLibreSyncResult & { message?: string };
      if (!response.ok) throw new Error(result.message || "No se pudieron sincronizar las publicaciones.");
      toast.success(`Se sincronizaron ${result.total} publicaciones.`);
      await load();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "No se pudieron sincronizar las publicaciones.");
      await load();
    } finally {
      setSyncing(false);
    }
  };

  const changePage = async (nextPage: number) => {
    if (!selectedAccountId || nextPage < 1 || nextPage > publicaciones.totalPages) return;
    setPage(nextPage);
    try { await loadPublications(selectedAccountId, nextPage); } catch (requestError) { toast.error(requestError instanceof Error ? requestError.message : "No se pudieron cargar las publicaciones."); }
  };

  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-slate-50 p-4 dark:bg-slate-950 md:p-6">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-slate-800 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Integraciones</p>
            <h1 className="mt-2 text-2xl font-black text-slate-900 dark:text-white">Mercado Libre</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">Importá publicaciones existentes y vinculalas con el catálogo IMC.</p>
          </div>
          <button type="button" onClick={() => { window.location.href = "/api/integraciones/mercadolibre/conectar"; }} disabled={!canManage || syncing} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-yellow-400 px-4 text-xs font-black uppercase tracking-widest text-slate-950 transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-50">
            <Link2 className="h-4 w-4" /> Conectar cuenta
          </button>
        </header>

        <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950 dark:border-blue-900/70 dark:bg-blue-950/30 dark:text-blue-100">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-300" />
            <p>La sincronización solo lee publicaciones de Mercado Libre. No modifica precios, stock ni publicaciones desde IMC.</p>
          </div>
          {selectedAccountId && <button type="button" onClick={sync} disabled={!canManage || syncing} className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-xs font-black uppercase tracking-widest text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />{syncing ? "Sincronizando" : "Sincronizar ahora"}</button>}
        </section>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300">{error}</div>}

        {cuentas.length > 0 && <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {cuentas.map((cuenta) => <button key={cuenta.id} type="button" onClick={() => void selectAccount(cuenta.id)} className={`rounded-lg border p-4 text-left transition ${cuenta.id === selectedAccountId ? "border-blue-500 bg-blue-500/5" : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950"}`}>
            <div className="flex items-center justify-between gap-3"><span className="text-sm font-black text-slate-900 dark:text-white">{cuenta.nickname || `Vendedor ${cuenta.sellerId}`}</span><span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[9px] font-black uppercase text-emerald-700 dark:text-emerald-300">Conectada</span></div>
            <p className="mt-2 text-xs font-bold text-slate-500">Seller ID {cuenta.sellerId} · {cuenta.siteId}</p>
            <p className="mt-3 text-xs text-slate-500">{date(cuenta.ultimaSincronizacionAt)}</p>
            {cuenta.ultimoEstadoSincronizacion === "ERROR" && cuenta.ultimoErrorSincronizacion && <p className="mt-2 text-xs font-bold text-red-600 dark:text-red-300">{cuenta.ultimoErrorSincronizacion}</p>}
          </button>)}
        </section>}

        {!loading && !error && cuentas.length === 0 && <section className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-950"><Unlink className="h-8 w-8 text-slate-400" /><h2 className="mt-4 text-lg font-black text-slate-900 dark:text-white">Todavía no hay una cuenta conectada</h2><p className="mt-2 max-w-md text-sm font-medium text-slate-500">Conectá la cuenta vendedora para importar sus publicaciones existentes.</p></section>}

        {selectedAccountId && <section className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 dark:border-slate-800"><div><h2 className="text-sm font-black text-slate-900 dark:text-white">Publicaciones sincronizadas</h2><p className="mt-1 text-xs font-medium text-slate-500">{publicaciones.totalCount.toLocaleString("es-AR")} publicaciones importadas.</p></div></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-xs"><thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:bg-slate-900"><tr><th className="px-3 py-3">Publicación</th><th className="px-3 py-3">SKU ML</th><th className="px-3 py-3">Estado</th><th className="px-3 py-3">Precio</th><th className="px-3 py-3 text-right">Stock ML</th><th className="px-3 py-3">Vínculo IMC</th><th className="px-3 py-3"></th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {publicaciones.data.length === 0 ? <tr><td colSpan={7} className="px-4 py-12 text-center font-bold text-slate-400">{syncing ? "Leyendo publicaciones..." : "Todavía no se importaron publicaciones."}</td></tr> : publicaciones.data.map((item) => <tr key={item.id}><td className="px-3 py-3"><div className="max-w-md truncate font-black text-slate-900 dark:text-white" title={item.titulo}>{item.titulo}</div><div className="mt-1 font-mono text-[10px] text-slate-500">{item.itemId}</div></td><td className="px-3 py-3 font-mono font-bold">{item.sellerSku || "-"}</td><td className="px-3 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-200">{item.estado}</span></td><td className="px-3 py-3 font-mono font-black">{money(item.precio, item.moneda)}</td><td className="px-3 py-3 text-right font-mono font-black">{item.cantidadDisponible ?? "-"}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${linkBadge(item.tipoVinculo)}`}>{item.tipoVinculo === "CODIGO_EXACTO" ? "Código exacto" : item.tipoVinculo === "MANUAL" ? "Manual" : "Sin vínculo"}</span>{item.codigoProducto && <div className="mt-1 font-mono text-[10px] text-slate-500">{item.codigoProducto}</div>}</td><td className="px-3 py-3 text-right">{item.permalink && <a href={item.permalink} target="_blank" rel="noreferrer" title="Abrir publicación" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-blue-600 hover:bg-blue-500/10 dark:text-blue-300"><ExternalLink className="h-4 w-4" /></a>}</td></tr>)}</tbody></table></div>
          {publicaciones.totalPages > 1 && <div className="flex items-center justify-center gap-3 border-t border-slate-200 p-4 dark:border-slate-800"><button type="button" onClick={() => void changePage(page - 1)} disabled={page <= 1} className="h-9 rounded-lg border border-slate-300 px-3 text-xs font-black disabled:opacity-40 dark:border-slate-700">Anterior</button><span className="text-xs font-bold text-slate-500">Página {page} de {publicaciones.totalPages}</span><button type="button" onClick={() => void changePage(page + 1)} disabled={page >= publicaciones.totalPages} className="h-9 rounded-lg border border-slate-300 px-3 text-xs font-black disabled:opacity-40 dark:border-slate-700">Siguiente</button></div>}
        </section>}
      </div>
    </main>
  );
}
