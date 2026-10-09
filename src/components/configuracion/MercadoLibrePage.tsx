"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, ChevronUp, CircleDollarSign, ExternalLink, Link2, MessageCircle, Package, RefreshCw, Send, Settings2, ShieldCheck, ShoppingCart, Unlink } from "lucide-react";
import { toast } from "sonner";

import type {
  MercadoLibreCuentaEstado,
  MercadoLibreCostoEstimado,
  MercadoLibrePreguntasResult,
  MercadoLibrePublicacionesResult,
  MercadoLibreSyncResult,
  MercadoLibreVentasResult,
} from "@/interfaces/mercadolibre";

type Props = { canManage: boolean };
type Tab = "VENTAS" | "PUBLICACIONES" | "COSTOS" | "PREGUNTAS" | "SINCRONIZACION";
type QuestionStatus = "POR_RESPONDER" | "RESPONDIDAS";
type DateOrder = "DESC" | "ASC";

const TABS: Array<{ id: Tab; label: string; icon: typeof ShoppingCart }> = [
  { id: "VENTAS", label: "Ventas", icon: ShoppingCart },
  { id: "PUBLICACIONES", label: "Publicaciones", icon: ExternalLink },
  { id: "COSTOS", label: "Costos ML", icon: CircleDollarSign },
  { id: "PREGUNTAS", label: "Preguntas", icon: MessageCircle },
  { id: "SINCRONIZACION", label: "Sincronizacion", icon: Settings2 },
];

function money(value: number | null, currency: string | null) {
  return value === null ? "-" : new Intl.NumberFormat("es-AR", { style: "currency", currency: currency || "ARS", maximumFractionDigits: 2 }).format(value);
}

function date(value: string | null, empty = "Sin sincronizar") {
  return value ? new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : empty;
}

function publicationLinkBadge(tipo: "SIN_VINCULO" | "CODIGO_EXACTO" | "MANUAL" | "EXCLUIDO_MANUAL") {
  if (tipo === "CODIGO_EXACTO") return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (tipo === "MANUAL") return "bg-blue-500/10 text-blue-700 dark:text-blue-300";
  if (tipo === "EXCLUIDO_MANUAL") return "bg-slate-500/10 text-slate-600 dark:text-slate-300";
  return "bg-amber-500/10 text-amber-700 dark:text-amber-300";
}

function publicationLinkLabel(tipo: "SIN_VINCULO" | "CODIGO_EXACTO" | "MANUAL" | "EXCLUIDO_MANUAL") {
  if (tipo === "CODIGO_EXACTO") return "Codigo exacto";
  if (tipo === "MANUAL") return "Manual";
  if (tipo === "EXCLUIDO_MANUAL") return "Excluido";
  return "Sin vinculo";
}

export function MercadoLibrePage({ canManage }: Props) {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>("VENTAS");
  const [cuentas, setCuentas] = useState<MercadoLibreCuentaEstado[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [ventas, setVentas] = useState<MercadoLibreVentasResult>({ data: [], totalCount: 0, totalPages: 0 });
  const [publicaciones, setPublicaciones] = useState<MercadoLibrePublicacionesResult>({ data: [], totalCount: 0, totalPages: 0 });
  const [preguntas, setPreguntas] = useState<MercadoLibrePreguntasResult>({ data: [], totalCount: 0, totalPages: 0 });
  const [pages, setPages] = useState<Record<Tab, number>>({ VENTAS: 1, PUBLICACIONES: 1, COSTOS: 1, PREGUNTAS: 1, SINCRONIZACION: 1 });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [questionStatus, setQuestionStatus] = useState<QuestionStatus>("POR_RESPONDER");
  const [questionOrder, setQuestionOrder] = useState<DateOrder>("DESC");
  const [salesSyncError, setSalesSyncError] = useState<string | null>(null);
  const [questionSyncError, setQuestionSyncError] = useState<string | null>(null);
  const [answeringQuestionId, setAnsweringQuestionId] = useState<string | null>(null);
  const [calculatingCostItemId, setCalculatingCostItemId] = useState<string | null>(null);
  const salesRefreshInFlight = useRef(false);

  const loadTab = useCallback(async (accountId: number, nextTab: Tab, page = 1) => {
    if (nextTab === "SINCRONIZACION") return;
    const path = nextTab === "VENTAS" ? "ventas" : nextTab === "PREGUNTAS" ? "preguntas" : "publicaciones";
    const params = new URLSearchParams({ idCuenta: String(accountId), page: String(page) });
    if (nextTab === "PREGUNTAS") {
      params.set("estado", questionStatus);
      params.set("orden", questionOrder);
    }
    const response = await fetch(`/api/integraciones/mercadolibre/${path}?${params.toString()}`, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "No se pudo cargar la informacion de Mercado Libre.");
    if (nextTab === "VENTAS") setVentas(data);
    if (nextTab === "PUBLICACIONES" || nextTab === "COSTOS") setPublicaciones(data);
    if (nextTab === "PREGUNTAS") setPreguntas(data);
  }, [questionOrder, questionStatus]);

  const load = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const response = await fetch("/api/integraciones/mercadolibre/estado", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "No se pudo cargar Mercado Libre.");
      const nextAccounts = data.cuentas as MercadoLibreCuentaEstado[];
      setCuentas(nextAccounts);
      const accountId = nextAccounts.some((account) => account.id === selectedAccountId) ? selectedAccountId : nextAccounts[0]?.id ?? null;
      setSelectedAccountId(accountId);
      if (accountId) await loadTab(accountId, tab, pages[tab]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo cargar Mercado Libre.");
    } finally {
      setLoading(false);
    }
  }, [loadTab, pages, selectedAccountId, tab]);

  const refreshQuestionInbox = useCallback(async (accountId: number) => {
    const response = await fetch("/api/integraciones/mercadolibre/preguntas/sincronizar", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idCuenta: accountId }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "No se pudieron consultar las preguntas nuevas.");
    await loadTab(accountId, "PREGUNTAS", pages.PREGUNTAS);
  }, [loadTab, pages.PREGUNTAS]);

  const refreshSalesInbox = useCallback(async (accountId: number) => {
    if (salesRefreshInFlight.current) return;
    salesRefreshInFlight.current = true;
    try {
      const response = await fetch("/api/integraciones/mercadolibre/ventas/sincronizar", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idCuenta: accountId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "No se pudieron consultar las ventas nuevas.");
      await loadTab(accountId, "VENTAS", pages.VENTAS);
    } finally {
      salesRefreshInFlight.current = false;
    }
  }, [loadTab, pages.VENTAS]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!selectedAccountId || tab === "SINCRONIZACION" || tab === "PREGUNTAS" || tab === "VENTAS") return;
    const interval = window.setInterval(() => {
      void loadTab(selectedAccountId, tab, pages[tab]).catch(() => undefined);
    }, 15_000);
    return () => window.clearInterval(interval);
  }, [loadTab, pages, selectedAccountId, tab]);
  useEffect(() => {
    if (!selectedAccountId || tab !== "VENTAS") return;
    const update = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        await refreshSalesInbox(selectedAccountId);
        setSalesSyncError(null);
      } catch (requestError) {
        setSalesSyncError(requestError instanceof Error ? requestError.message : "No se pudieron consultar las ventas nuevas.");
      }
    };
    void update();
    const interval = window.setInterval(() => { void update(); }, 20_000);
    return () => window.clearInterval(interval);
  }, [refreshSalesInbox, selectedAccountId, tab]);
  useEffect(() => {
    if (!selectedAccountId || tab !== "PREGUNTAS") return;
    const update = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        await refreshQuestionInbox(selectedAccountId);
        setQuestionSyncError(null);
      } catch (requestError) {
        setQuestionSyncError(requestError instanceof Error ? requestError.message : "No se pudieron consultar las preguntas nuevas.");
      }
    };
    void update();
    const interval = window.setInterval(() => { void update(); }, 20_000);
    return () => window.clearInterval(interval);
  }, [refreshQuestionInbox, selectedAccountId, tab]);
  useEffect(() => {
    if (searchParams.get("meli") === "conectado") toast.success("Cuenta de Mercado Libre conectada.");
    if (searchParams.get("meli") === "error") toast.error(searchParams.get("mensaje") || "No se pudo conectar Mercado Libre.");
  }, [searchParams]);

  const changeTab = async (nextTab: Tab) => {
    setTab(nextTab); setSearch("");
    if (!selectedAccountId) return;
    try {
      if (nextTab === "PREGUNTAS") await refreshQuestionInbox(selectedAccountId);
      else if (nextTab === "VENTAS") await refreshSalesInbox(selectedAccountId);
      else await loadTab(selectedAccountId, nextTab, pages[nextTab]);
    }
    catch (requestError) { toast.error(requestError instanceof Error ? requestError.message : "No se pudo cargar la seccion."); }
  };

  const selectAccount = async (accountId: number) => {
    setSelectedAccountId(accountId); setSearch("");
    try { await loadTab(accountId, tab, 1); }
    catch (requestError) { toast.error(requestError instanceof Error ? requestError.message : "No se pudo cargar la cuenta."); }
  };

  const changePage = async (nextPage: number) => {
    if (!selectedAccountId || nextPage < 1) return;
    const totalPages = tab === "VENTAS" ? ventas.totalPages : tab === "PREGUNTAS" ? preguntas.totalPages : publicaciones.totalPages;
    if (nextPage > totalPages) return;
    setPages((current) => ({ ...current, [tab]: nextPage }));
    try { await loadTab(selectedAccountId, tab, nextPage); }
    catch (requestError) { toast.error(requestError instanceof Error ? requestError.message : "No se pudo cambiar de pagina."); }
  };

  const changeQuestionFilter = (type: "estado" | "orden", value: string) => {
    setPages((current) => ({ ...current, PREGUNTAS: 1 }));
    if (type === "estado") setQuestionStatus(value as QuestionStatus);
    else setQuestionOrder(value as DateOrder);
  };

  const sync = async () => {
    if (!selectedAccountId) return;
    try {
      setSyncing(true);
      const response = await fetch("/api/integraciones/mercadolibre/sincronizar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idCuenta: selectedAccountId }) });
      const result = await response.json().catch(() => ({})) as MercadoLibreSyncResult & { message?: string };
      if (!response.ok) throw new Error(result.message || "No se pudo sincronizar Mercado Libre.");
      toast.success(`${result.total} publicaciones, ${result.ventas || 0} ventas y ${result.preguntas || 0} preguntas actualizadas.`);
      await load();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "No se pudo sincronizar Mercado Libre.");
    } finally { setSyncing(false); }
  };

  const answerQuestion = async (preguntaId: string, texto: string) => {
    if (!selectedAccountId) return;
    try {
      setAnsweringQuestionId(preguntaId);
      const response = await fetch("/api/integraciones/mercadolibre/preguntas/responder", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idCuenta: selectedAccountId, preguntaId, texto }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "No se pudo responder la pregunta.");
      toast.success("Respuesta enviada a Mercado Libre.");
      await refreshQuestionInbox(selectedAccountId);
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "No se pudo responder la pregunta.");
    } finally { setAnsweringQuestionId(null); }
  };

  const calculateCost = async (itemId: string) => {
    if (!selectedAccountId) return;
    try {
      setCalculatingCostItemId(itemId);
      const response = await fetch("/api/integraciones/mercadolibre/costos", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idCuenta: selectedAccountId, itemId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "No se pudo calcular el costo de la publicacion.");
      setPublicaciones((current) => ({ ...current, data: current.data.map((item) => item.itemId === itemId ? { ...item, costoEstimado: result as MercadoLibreCostoEstimado } : item) }));
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "No se pudo calcular el costo de la publicacion.");
    } finally {
      setCalculatingCostItemId(null);
    }
  };

  const visibleVentas = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return ventas.data;
    return ventas.data.filter((venta) => [venta.ventaId, venta.numeroEnvio, venta.comprador, venta.estado, ...venta.items.flatMap((item) => [item.titulo, item.itemId, item.sku])].some((value) => String(value || "").toLowerCase().includes(term)));
  }, [search, ventas.data]);
  const visiblePublicaciones = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return publicaciones.data;
    return publicaciones.data.filter((item) => [item.itemId, item.sellerSku, item.titulo, item.codigoProducto, item.codigoKit].some((value) => String(value || "").toLowerCase().includes(term)));
  }, [publicaciones.data, search]);
  const visiblePreguntas = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return preguntas.data;
    return preguntas.data.filter((pregunta) => [pregunta.preguntaId, pregunta.itemId, pregunta.titulo, pregunta.comprador, pregunta.texto, pregunta.respuesta].some((value) => String(value || "").toLowerCase().includes(term)));
  }, [preguntas.data, search]);

  const activeAccount = cuentas.find((account) => account.id === selectedAccountId) || null;
  const activeResult = tab === "VENTAS" ? ventas : tab === "PREGUNTAS" ? preguntas : publicaciones;

  return <main className="min-h-[calc(100dvh-4rem)] bg-slate-50 p-4 dark:bg-slate-950 md:p-6"><div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4">
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800"><div><p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Operaciones</p><h1 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">Mercado Libre</h1></div><div className="flex items-center gap-2"><button type="button" onClick={() => { window.location.href = "/api/integraciones/mercadolibre/conectar"; }} disabled={!canManage || syncing} className="inline-flex h-10 items-center gap-2 rounded-lg border border-yellow-300 bg-yellow-300 px-3 text-xs font-black text-slate-950 transition hover:bg-yellow-200 disabled:cursor-not-allowed disabled:opacity-50"><Link2 className="h-4 w-4" />Conectar cuenta</button>{selectedAccountId && <button type="button" onClick={() => void sync()} disabled={!canManage || syncing} className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-black text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />{syncing ? "Sincronizando" : "Sincronizar"}</button>}</div></header>

    {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300">{error}</div>}
    {!loading && !error && cuentas.length === 0 && <section className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-950"><Unlink className="h-8 w-8 text-slate-400" /><h2 className="mt-4 text-lg font-black text-slate-900 dark:text-white">No hay una cuenta conectada</h2></section>}

    {cuentas.length > 0 && <>
      <section className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950"><label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Cuenta</label><select value={selectedAccountId || ""} onChange={(event) => void selectAccount(Number(event.target.value))} className="h-9 min-w-56 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white">{cuentas.map((cuenta) => <option key={cuenta.id} value={cuenta.id}>{cuenta.nickname || `Vendedor ${cuenta.sellerId}`} · {cuenta.siteId}</option>)}</select>{activeAccount && <span className="text-xs text-slate-500">Ultima sincronizacion: <strong className="text-slate-700 dark:text-slate-200">{date(activeAccount.ultimaSincronizacionAt)}</strong></span>}</section>
      <nav className="flex overflow-x-auto border-b border-slate-200 dark:border-slate-800" aria-label="Secciones de Mercado Libre">{TABS.map((item) => { const Icon = item.icon; const active = tab === item.id; return <button key={item.id} type="button" onClick={() => void changeTab(item.id)} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-xs font-black uppercase tracking-wide transition ${active ? "border-blue-600 text-blue-600 dark:text-blue-300" : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"}`}><Icon className="h-4 w-4" />{item.label}</button>; })}</nav>
      {tab !== "SINCRONIZACION" && <div className="flex flex-wrap items-center gap-2">{tab === "PREGUNTAS" && <><label className="sr-only" htmlFor="preguntas-estado">Estado de preguntas</label><select id="preguntas-estado" value={questionStatus} onChange={(event) => changeQuestionFilter("estado", event.target.value)} className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="POR_RESPONDER">Por responder</option><option value="RESPONDIDAS">Respondidas</option></select><label className="sr-only" htmlFor="preguntas-orden">Orden de preguntas</label><select id="preguntas-orden" value={questionOrder} onChange={(event) => changeQuestionFilter("orden", event.target.value)} className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="DESC">Mas nuevas primero</option><option value="ASC">Mas viejas primero</option></select></>}<div className="relative min-w-[240px] flex-1"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tab === "VENTAS" ? "Nombre / Usuario ML / Item / SKU / # Venta / Nro. envio" : tab === "PREGUNTAS" ? "Pregunta, cliente, MLA o publicacion" : tab === "COSTOS" ? "MLA, SKU, titulo o codigo IMC" : "Titulo, MLA, SKU o codigo IMC"} className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></div><span className="text-xs font-medium text-slate-500">{activeResult.totalCount.toLocaleString("es-AR")} registros</span></div>}
      {tab === "VENTAS" && salesSyncError && <p className="text-xs font-bold text-red-600 dark:text-red-300">{salesSyncError}</p>}
      {tab === "PREGUNTAS" && questionSyncError && <p className="text-xs font-bold text-red-600 dark:text-red-300">{questionSyncError}</p>}
      {tab === "VENTAS" && <VentasTable ventas={visibleVentas} loading={loading} />}
      {tab === "PUBLICACIONES" && <PublicacionesTable publicaciones={visiblePublicaciones} loading={loading} />}
      {tab === "COSTOS" && <CostosTable publicaciones={visiblePublicaciones} loading={loading} calculatingItemId={calculatingCostItemId} onCalculate={calculateCost} />}
      {tab === "PREGUNTAS" && <PreguntasTable preguntas={visiblePreguntas} loading={loading} canManage={canManage} answeringQuestionId={answeringQuestionId} onAnswer={answerQuestion} />}
      {tab === "SINCRONIZACION" && <SyncPanel account={activeAccount} onSync={() => void sync()} syncing={syncing} canManage={canManage} />}
      {tab !== "SINCRONIZACION" && activeResult.totalPages > 1 && <div className="flex items-center justify-center gap-3"><button type="button" onClick={() => void changePage(pages[tab] - 1)} disabled={pages[tab] <= 1} className="h-9 rounded-lg border border-slate-300 px-3 text-xs font-black disabled:opacity-40 dark:border-slate-700">Anterior</button><span className="text-xs font-bold text-slate-500">Pagina {pages[tab]} de {activeResult.totalPages}</span><button type="button" onClick={() => void changePage(pages[tab] + 1)} disabled={pages[tab] >= activeResult.totalPages} className="h-9 rounded-lg border border-slate-300 px-3 text-xs font-black disabled:opacity-40 dark:border-slate-700">Siguiente</button></div>}
    </>}
  </div></main>;
}

function VentasTable({ ventas, loading }: { ventas: MercadoLibreVentasResult["data"]; loading: boolean }) {
  return <TableShell hasRows={ventas.length > 0} empty={loading ? "Cargando ventas..." : "No hay ventas sincronizadas."}><table className="w-full min-w-[1040px] text-left text-xs [&_th]:bg-slate-50 [&_th]:px-3 [&_th]:py-3 [&_th]:text-[10px] [&_th]:font-black [&_th]:uppercase [&_th]:tracking-widest [&_th]:text-slate-500 dark:[&_th]:bg-slate-900 [&_td]:border-t [&_td]:border-slate-100 [&_td]:px-3 [&_td]:py-3 dark:[&_td]:border-slate-800"><thead><tr><th>Fecha</th><th>Cliente</th><th>Items</th><th>Envio</th><th>Estado</th><th className="text-right">Total</th></tr></thead><tbody>{ventas.map((venta) => <tr key={venta.id}><td><div className="font-bold text-slate-800 dark:text-white">{date(venta.fecha, "-")}</div><div className="mt-1 font-mono text-[10px] text-slate-500">#{venta.ventaId}</div></td><td className="font-bold text-slate-800 dark:text-white">{venta.comprador || "-"}</td><td><div className="max-w-md space-y-1">{venta.items.map((item, index) => <div key={`${venta.id}-${index}`} className="truncate font-semibold text-slate-700 dark:text-slate-200" title={item.titulo}>{item.cantidad}x {item.titulo}{item.sku && <span className="ml-1 font-mono text-slate-400">[{item.sku}]</span>}</div>)}</div></td><td><div>{venta.retiroEnPersona ? "Retira en persona" : venta.envio || "-"}</div>{venta.numeroEnvio && <div className="mt-1 font-mono text-[10px] text-slate-500">#{venta.numeroEnvio}</div>}</td><td><StateBadge value={venta.estado} /></td><td className="text-right font-mono font-black text-slate-800 dark:text-white">{money(venta.total, venta.moneda)}</td></tr>)}</tbody></table></TableShell>;
}

function PublicacionesTable({ publicaciones, loading }: { publicaciones: MercadoLibrePublicacionesResult["data"]; loading: boolean }) {
  return <TableShell hasRows={publicaciones.length > 0} empty={loading ? "Cargando publicaciones..." : "No hay publicaciones sincronizadas."}>
    <table className="w-full min-w-[1210px] text-left text-xs">
      <thead><tr><th>Publicacion</th><th>SKU ML</th><th>Estado</th><th>Precio ML</th><th className="text-right">Stock ML</th><th>Fechas</th><th>Vinculo IMC</th><th /></tr></thead>
      <tbody>{publicaciones.map((item) => <tr key={item.id}>
        <td><div className="max-w-md truncate font-black text-slate-900 dark:text-white" title={item.titulo}>{item.titulo}</div><div className="mt-1 font-mono text-[10px] text-slate-500">{item.itemId}</div></td>
        <td className="font-mono font-bold">{item.sellerSku || "-"}</td><td><StateBadge value={item.estado} /></td><td className="font-mono font-black">{money(item.precio, item.moneda)}</td><td className="text-right font-mono font-black">{item.cantidadDisponible ?? "-"}</td>
        <td className="whitespace-nowrap text-[10px] leading-5 text-slate-500 dark:text-slate-300"><div><b>Creada:</b> {date(item.fechaCreacionMl, "-")}</div><div><b>Editada:</b> {date(item.fechaActualizacionMl, "-")}</div><div><b>Sync IMC:</b> {date(item.sincronizadaAt, "-")}</div></td>
        <td><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${publicationLinkBadge(item.tipoVinculo)}`}>{publicationLinkLabel(item.tipoVinculo)}</span>{(item.codigoProducto || item.codigoKit) && <div className="mt-1 font-mono text-[10px] text-slate-500">{item.codigoProducto || item.codigoKit}</div>}</td>
        <td className="text-right">{item.permalink && <a href={item.permalink} target="_blank" rel="noreferrer" title="Abrir publicacion" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-blue-600 hover:bg-blue-500/10 dark:text-blue-300"><ExternalLink className="h-4 w-4" /></a>}</td>
      </tr>)}</tbody>
    </table>
  </TableShell>;
}

function CostosTable({ publicaciones, loading, calculatingItemId, onCalculate }: {
  publicaciones: MercadoLibrePublicacionesResult["data"];
  loading: boolean;
  calculatingItemId: string | null;
  onCalculate: (itemId: string) => void;
}) {
  return <TableShell hasRows={publicaciones.length > 0} empty={loading ? "Cargando publicaciones..." : "No hay publicaciones sincronizadas."}>
    <table className="w-full min-w-[1340px] text-left text-xs">
      <thead><tr><th>Publicacion</th><th>SKU</th><th className="text-right">Precio</th><th>Tipo</th><th className="text-right">Comision</th><th className="text-right">Fijo</th><th className="text-right">Cuotas</th><th className="text-right">Envio est.</th><th className="text-right">Costo ML</th><th className="text-right">Neto est.</th><th>Consulta</th><th /></tr></thead>
      <tbody>{publicaciones.map((item) => {
        const costo = item.costoEstimado;
        const calculating = calculatingItemId === item.itemId;
        return <tr key={item.id}>
          <td><div className="max-w-xs truncate font-black text-slate-900 dark:text-white" title={item.titulo}>{item.titulo}</div><div className="mt-1 font-mono text-[10px] text-slate-500">{item.itemId}</div>{costo?.advertencias?.[0] && <div className="mt-1 max-w-xs truncate text-[10px] font-semibold text-amber-600 dark:text-amber-300" title={costo.advertencias.join(" ")}>{costo.advertencias[0]}</div>}</td>
          <td className="font-mono font-bold">{item.sellerSku || item.codigoProducto || item.codigoKit || "-"}</td>
          <td className="text-right font-mono font-black">{money(item.precio, item.moneda)}</td>
          <td className="font-bold text-slate-600 dark:text-slate-300">{item.tipoPublicacion || "-"}</td>
          <td className="text-right font-mono">{money(costo?.comisionTotal ?? null, item.moneda)}</td>
          <td className="text-right font-mono">{money(costo?.cargoFijo ?? null, item.moneda)}</td>
          <td className="text-right font-mono">{money(costo?.cargoFinanciacion ?? null, item.moneda)}</td>
          <td className="text-right font-mono">{money(costo?.envioEstimado ?? null, item.moneda)}</td>
          <td className="text-right font-mono font-black text-red-600 dark:text-red-300">{money(costo?.costoMlTotal ?? null, item.moneda)}</td>
          <td className="text-right font-mono font-black text-emerald-600 dark:text-emerald-300">{money(costo?.netoEstimado ?? null, item.moneda)}</td>
          <td className="whitespace-nowrap text-[10px] font-semibold text-slate-500">{costo?.consultadoAt ? date(costo.consultadoAt, "-") : "Sin calcular"}</td>
          <td className="text-right"><button type="button" onClick={() => onCalculate(item.itemId)} disabled={calculating} title="Actualizar costo estimado" aria-label={`Actualizar costo estimado de ${item.titulo}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-blue-600 transition hover:bg-blue-500/10 disabled:opacity-50 dark:text-blue-300"><RefreshCw className={`h-4 w-4 ${calculating ? "animate-spin" : ""}`} /></button></td>
        </tr>;
      })}</tbody>
    </table>
  </TableShell>;
}

function PreguntasTable({ preguntas, loading, canManage, answeringQuestionId, onAnswer }: {
  preguntas: MercadoLibrePreguntasResult["data"];
  loading: boolean;
  canManage: boolean;
  answeringQuestionId: string | null;
  onAnswer: (preguntaId: string, texto: string) => Promise<void>;
}) {
  if (!preguntas.length) return <TableShell hasRows={false} empty={loading ? "Cargando preguntas..." : "No hay preguntas sincronizadas."}>{null}</TableShell>;
  return <section className="space-y-3">{preguntas.map((pregunta) => <PreguntaCard key={pregunta.id} pregunta={pregunta} canManage={canManage} sending={answeringQuestionId === pregunta.preguntaId} onAnswer={onAnswer} />)}</section>;
}

function PreguntaCard({ pregunta, canManage, sending, onAnswer }: {
  pregunta: MercadoLibrePreguntasResult["data"][number];
  canManage: boolean;
  sending: boolean;
  onAnswer: (preguntaId: string, texto: string) => Promise<void>;
}) {
  const [texto, setTexto] = useState("");
  const [showPrevious, setShowPrevious] = useState(false);
  const respond = async () => { await onAnswer(pregunta.preguntaId, texto); setTexto(""); };
  return <article className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
    <header className="grid gap-3 p-4 sm:grid-cols-[3rem_minmax(0,1fr)_auto_auto] sm:items-center">
      <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">{pregunta.thumbnailUrl ? <img src={pregunta.thumbnailUrl} alt="" className="h-full w-full object-contain" /> : <Package className="h-5 w-5 text-slate-400" />}</div>
      <div className="min-w-0"><p className="font-mono text-[10px] font-bold uppercase text-slate-500">{pregunta.sellerSku ? `SKU ${pregunta.sellerSku}` : pregunta.itemId || "Publicacion"}</p><p className="truncate text-sm font-black text-slate-900 dark:text-white" title={pregunta.titulo || ""}>{pregunta.titulo || pregunta.itemId || "Sin titulo"}</p></div>
      <div className="text-sm font-black text-slate-800 dark:text-white">{money(pregunta.precio, pregunta.moneda)}</div>
      <div className="text-sm font-bold text-slate-500">{pregunta.cantidadDisponible === null ? "" : `${pregunta.cantidadDisponible} unidades`}</div>
    </header>
    <div className="border-t border-slate-200 px-4 py-4 dark:border-slate-800">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500"><span className="font-bold text-slate-800 dark:text-white">{pregunta.comprador || "Cliente"}</span><span>{date(pregunta.fecha, "-")}</span><StateBadge value={pregunta.estado} /></div>
      <p className="mt-2 text-sm font-bold text-slate-900 dark:text-white">{pregunta.texto}</p>
      {pregunta.estado === "UNANSWERED" ? <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"><div><textarea value={texto} onChange={(event) => setTexto(event.target.value)} maxLength={2000} disabled={!canManage || sending} placeholder="Escribi la respuesta" className="min-h-24 w-full resize-y rounded-md border border-slate-300 bg-white p-3 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /><span className="mt-1 block text-right text-[10px] font-medium text-slate-400">{texto.length}/2000</span></div><button type="button" disabled={!canManage || sending || !texto.trim()} onClick={() => void respond()} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-xs font-black text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"><Send className="h-4 w-4" />{sending ? "Enviando" : "Responder"}</button></div> : <div className="mt-3 border-l-2 border-blue-500 pl-3 text-sm text-slate-600 dark:text-slate-300">{pregunta.respuesta || "Sin respuesta disponible"}</div>}
      {pregunta.anteriores.length > 0 && <div className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-800"><button type="button" onClick={() => setShowPrevious((value) => !value)} className="inline-flex items-center gap-2 text-xs font-black text-blue-600 hover:text-blue-500 dark:text-blue-300">{showPrevious ? "Ocultar preguntas anteriores" : `Ver preguntas anteriores (${pregunta.anteriores.length})`}{showPrevious ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button>{showPrevious && <ol className="mt-3 space-y-3">{pregunta.anteriores.map((anterior) => <li key={anterior.preguntaId} className="border-l-2 border-slate-200 pl-3 text-sm dark:border-slate-700"><div className="flex flex-wrap gap-x-2 text-xs text-slate-500"><span>{date(anterior.fecha, "-")}</span><StateBadge value={anterior.estado} /></div><p className="mt-1 font-semibold text-slate-800 dark:text-slate-100">{anterior.texto}</p>{anterior.respuesta && <p className="mt-1 text-slate-500 dark:text-slate-300">{anterior.respuesta}</p>}</li>)}</ol>}</div>}
    </div>
  </article>;
}

function SyncPanel({ account, onSync, syncing, canManage }: { account: MercadoLibreCuentaEstado | null; onSync: () => void; syncing: boolean; canManage: boolean }) {
  return <section className="grid gap-4 lg:grid-cols-2"><div className="border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950"><div className="flex items-start gap-3"><ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-300" /><div><h2 className="text-sm font-black text-slate-900 dark:text-white">Sincronizacion de solo lectura</h2><p className="mt-1 text-sm leading-6 text-slate-500">IMC importa publicaciones, ventas y preguntas. No modifica precios, stock ni publicaciones en Mercado Libre.</p></div></div><button type="button" onClick={onSync} disabled={!canManage || syncing} className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-black text-white transition hover:bg-blue-500 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />{syncing ? "Sincronizando" : "Sincronizar ahora"}</button></div><div className="border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950"><h2 className="text-sm font-black text-slate-900 dark:text-white">Estado de cuenta</h2><dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-4"><dt className="text-slate-500">Cuenta</dt><dd className="font-bold text-slate-800 dark:text-white">{account?.nickname || "-"}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Ultima sincronizacion</dt><dd className="font-bold text-slate-800 dark:text-white">{date(account?.ultimaSincronizacionAt || null)}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Resultado</dt><dd className="font-bold text-slate-800 dark:text-white">{account?.ultimoEstadoSincronizacion || "Sin ejecuciones"}</dd></div></dl>{account?.ultimoErrorSincronizacion && <p className="mt-4 border-t border-red-100 pt-3 text-xs font-semibold text-red-600 dark:border-red-950 dark:text-red-300">{account.ultimoErrorSincronizacion}</p>}</div></section>;
}

function TableShell({ children, empty, hasRows }: { children: React.ReactNode; empty: string; hasRows: boolean }) {
  return <section className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 [&_thead]:bg-slate-50 dark:[&_thead]:bg-slate-900 [&_th]:px-3 [&_th]:py-3 [&_th]:text-[10px] [&_th]:font-black [&_th]:uppercase [&_th]:tracking-widest [&_th]:text-slate-500 [&_td]:border-t [&_td]:border-slate-100 [&_td]:px-3 [&_td]:py-3 dark:[&_td]:border-slate-800"><div className="overflow-x-auto">{hasRows ? children : <div className="px-4 py-16 text-center text-sm font-semibold text-slate-400">{empty}</div>}</div></section>;
}

function StateBadge({ value }: { value: string }) {
  return <span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-200">{value}</span>;
}
