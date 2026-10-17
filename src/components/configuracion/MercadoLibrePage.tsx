"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Ban, Check, ChevronDown, ChevronUp, CircleDollarSign, Copy, ExternalLink, Link2, LoaderCircle, MessageCircle, MessageSquarePlus, Package, Pencil, Plus, RefreshCw, Search, Send, Settings2, ShieldCheck, ShoppingCart, Trash2, Unlink, X } from "lucide-react";
import { toast } from "sonner";

import type {
  MercadoLibreCuentaEstado,
  MercadoLibreCostoEstimado,
  MercadoLibreCostoSincronizacion,
  MercadoLibrePreguntasResult,
  MercadoLibrePublicacionesResult,
  MercadoLibrePublicacionListado,
  MercadoLibreSyncResult,
  MercadoLibreVentasResult,
} from "@/interfaces/mercadolibre";

type Props = { canManage: boolean };
type Tab = "VENTAS" | "PUBLICACIONES" | "COSTOS" | "PREGUNTAS" | "SINCRONIZACION";
type QuestionStatus = "POR_RESPONDER" | "RESPONDIDAS";
type DateOrder = "DESC" | "ASC";
type PublicationLinkFilter = "" | "SIN_VINCULO" | "EXCLUIDO_MANUAL";
type PublicationDateFilter = { desde: string; hasta: string };
type LinkCandidate = { tipo: "ITEM" | "KIT"; id: number; codigo: string; descripcion: string };
type QuickReply = { id: number; nombre: string; texto: string; orden: number; activo: boolean };

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
  const [publicationLinkFilter, setPublicationLinkFilter] = useState<PublicationLinkFilter>("");
  const [publicationDateFilter, setPublicationDateFilter] = useState<PublicationDateFilter>({ desde: "", hasta: "" });
  const deferredSearch = useDeferredValue(search.trim());
  const [questionStatus, setQuestionStatus] = useState<QuestionStatus>("POR_RESPONDER");
  const [questionOrder, setQuestionOrder] = useState<DateOrder>("DESC");
  const [salesSyncError, setSalesSyncError] = useState<string | null>(null);
  const [questionSyncError, setQuestionSyncError] = useState<string | null>(null);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [quickRepliesOpen, setQuickRepliesOpen] = useState(false);
  const [answeringQuestionId, setAnsweringQuestionId] = useState<string | null>(null);
  const [calculatingCostItemId, setCalculatingCostItemId] = useState<string | null>(null);
  const [calculatingCostPage, setCalculatingCostPage] = useState(false);
  const [costSync, setCostSync] = useState<MercadoLibreCostoSincronizacion | null>(null);
  const [massCostSyncing, setMassCostSyncing] = useState(false);
  const salesRefreshInFlight = useRef(false);
  const questionRefreshInFlight = useRef(false);
  const massCostSyncInFlight = useRef(false);

  const markAccountSynced = useCallback((accountId: number) => {
    const syncedAt = new Date().toISOString();
    setCuentas((current) => current.map((account) => account.id === accountId ? {
      ...account,
      ultimaSincronizacionAt: syncedAt,
      ultimoEstadoSincronizacion: "OK",
      ultimoErrorSincronizacion: null,
    } : account));
  }, []);

  const loadQuickReplies = useCallback(async (accountId: number) => {
    const response = await fetch(`/api/integraciones/mercadolibre/respuestas-rapidas?idCuenta=${accountId}`, { cache: "no-store" });
    if (!response.ok) throw new Error("No se pudieron cargar las respuestas rapidas.");
    setQuickReplies(await response.json());
  }, []);

  const loadTab = useCallback(async (
    accountId: number,
    nextTab: Tab,
    page = 1,
    publicationSearch = "",
    linkFilter: PublicationLinkFilter = "",
    publicationDates: PublicationDateFilter = { desde: "", hasta: "" },
  ) => {
    if (nextTab === "SINCRONIZACION") return;
    const path = nextTab === "VENTAS" ? "ventas" : nextTab === "PREGUNTAS" ? "preguntas" : "publicaciones";
    const params = new URLSearchParams({ idCuenta: String(accountId), page: String(page) });
    if (nextTab === "PREGUNTAS") {
      params.set("estado", questionStatus);
      params.set("orden", questionOrder);
    }
    if ((nextTab === "PUBLICACIONES" || nextTab === "COSTOS") && publicationSearch) params.set("q", publicationSearch);
    if (nextTab === "PUBLICACIONES" && linkFilter) params.set("vinculo", linkFilter);
    if (nextTab === "PUBLICACIONES" && publicationDates.desde) params.set("fechaDesde", publicationDates.desde);
    if (nextTab === "PUBLICACIONES" && publicationDates.hasta) params.set("fechaHasta", publicationDates.hasta);
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
      const isPublicationSearch = tab === "PUBLICACIONES" || tab === "COSTOS";
      const page = isPublicationSearch && deferredSearch ? 1 : pages[tab];
      if (isPublicationSearch && deferredSearch && pages[tab] !== 1) setPages((current) => ({ ...current, [tab]: 1 }));
      if (accountId) await loadTab(accountId, tab, page, isPublicationSearch ? deferredSearch : "", tab === "PUBLICACIONES" ? publicationLinkFilter : "", tab === "PUBLICACIONES" ? publicationDateFilter : undefined);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo cargar Mercado Libre.");
    } finally {
      setLoading(false);
    }
  }, [deferredSearch, loadTab, pages, publicationDateFilter, publicationLinkFilter, selectedAccountId, tab]);

  const refreshQuestionInbox = useCallback(async (accountId: number) => {
    if (questionRefreshInFlight.current) return;
    questionRefreshInFlight.current = true;
    try {
      const response = await fetch("/api/integraciones/mercadolibre/preguntas/sincronizar", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idCuenta: accountId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "No se pudieron consultar las preguntas nuevas.");
      markAccountSynced(accountId);
      await loadTab(accountId, "PREGUNTAS", pages.PREGUNTAS);
    } finally {
      questionRefreshInFlight.current = false;
    }
  }, [loadTab, markAccountSynced, pages.PREGUNTAS]);

  const refreshSalesInbox = useCallback(async (accountId: number) => {
    if (salesRefreshInFlight.current) return;
    salesRefreshInFlight.current = true;
    try {
      const response = await fetch("/api/integraciones/mercadolibre/ventas/sincronizar", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idCuenta: accountId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "No se pudieron consultar las ventas nuevas.");
      markAccountSynced(accountId);
      await loadTab(accountId, "VENTAS", pages.VENTAS);
    } finally {
      salesRefreshInFlight.current = false;
    }
  }, [loadTab, markAccountSynced, pages.VENTAS]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!selectedAccountId || tab === "SINCRONIZACION" || tab === "PREGUNTAS" || tab === "VENTAS") return;
    const interval = window.setInterval(() => {
      void loadTab(selectedAccountId, tab, pages[tab], deferredSearch, tab === "PUBLICACIONES" ? publicationLinkFilter : "", tab === "PUBLICACIONES" ? publicationDateFilter : undefined).catch(() => undefined);
    }, 15_000);
    return () => window.clearInterval(interval);
  }, [deferredSearch, loadTab, pages, publicationDateFilter, publicationLinkFilter, selectedAccountId, tab]);
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
    if (!selectedAccountId || tab !== "PREGUNTAS") return;
    void loadQuickReplies(selectedAccountId).catch(() => setQuickReplies([]));
  }, [loadQuickReplies, selectedAccountId, tab]);
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
      else await loadTab(selectedAccountId, nextTab, pages[nextTab], "", nextTab === "PUBLICACIONES" ? publicationLinkFilter : "", nextTab === "PUBLICACIONES" ? publicationDateFilter : undefined);
    }
    catch (requestError) { toast.error(requestError instanceof Error ? requestError.message : "No se pudo cargar la seccion."); }
  };

  const selectAccount = async (accountId: number) => {
    setSelectedAccountId(accountId); setSearch("");
    try { await loadTab(accountId, tab, 1, "", tab === "PUBLICACIONES" ? publicationLinkFilter : "", tab === "PUBLICACIONES" ? publicationDateFilter : undefined); }
    catch (requestError) { toast.error(requestError instanceof Error ? requestError.message : "No se pudo cargar la cuenta."); }
  };

  const changePage = async (nextPage: number) => {
    if (!selectedAccountId || nextPage < 1) return;
    const totalPages = tab === "VENTAS" ? ventas.totalPages : tab === "PREGUNTAS" ? preguntas.totalPages : publicaciones.totalPages;
    if (nextPage > totalPages) return;
    setPages((current) => ({ ...current, [tab]: nextPage }));
    try { await loadTab(selectedAccountId, tab, nextPage, tab === "PUBLICACIONES" || tab === "COSTOS" ? deferredSearch : "", tab === "PUBLICACIONES" ? publicationLinkFilter : "", tab === "PUBLICACIONES" ? publicationDateFilter : undefined); }
    catch (requestError) { toast.error(requestError instanceof Error ? requestError.message : "No se pudo cambiar de pagina."); }
  };

  const changeQuestionFilter = (type: "estado" | "orden", value: string) => {
    setPages((current) => ({ ...current, PREGUNTAS: 1 }));
    if (type === "estado") setQuestionStatus(value as QuestionStatus);
    else setQuestionOrder(value as DateOrder);
  };

  const changePublicationLinkFilter = (value: PublicationLinkFilter) => {
    setPublicationLinkFilter(value);
    setPages((current) => ({ ...current, PUBLICACIONES: 1 }));
  };

  const changePublicationDateFilter = (key: keyof PublicationDateFilter, value: string) => {
    setPublicationDateFilter((current) => ({ ...current, [key]: value }));
    setPages((current) => ({ ...current, PUBLICACIONES: 1 }));
  };

  const copyFilteredPublicationMlas = async () => {
    if (!selectedAccountId) return;
    try {
      const params = new URLSearchParams({ idCuenta: String(selectedAccountId) });
      if (deferredSearch) params.set("q", deferredSearch);
      if (publicationLinkFilter) params.set("vinculo", publicationLinkFilter);
      if (publicationDateFilter.desde) params.set("fechaDesde", publicationDateFilter.desde);
      if (publicationDateFilter.hasta) params.set("fechaHasta", publicationDateFilter.hasta);
      const response = await fetch(`/api/integraciones/mercadolibre/publicaciones/copiar?${params.toString()}`, { cache: "no-store" });
      const result = await response.json().catch(() => ({})) as { data?: MercadoLibrePublicacionListado[]; message?: string };
      if (!response.ok) throw new Error(result.message || "No se pudieron obtener las publicaciones filtradas.");

      const dateFormatter = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Argentina/Buenos_Aires" });
      const groups = new Map<string, { label: string; ids: string[] }>();
      for (const publication of result.data || []) {
        const id = publication.itemId.replace(/\D/g, "");
        if (!id) continue;
        const createdAt = publication.fechaCreacionMl ? new Date(publication.fechaCreacionMl) : null;
        const validDate = createdAt && !Number.isNaN(createdAt.getTime());
        const key = validDate ? createdAt.toISOString().slice(0, 10) : "9999-99-99";
        const current = groups.get(key) || { label: validDate ? dateFormatter.format(createdAt) : "Sin fecha", ids: [] };
        current.ids.push(id);
        groups.set(key, current);
      }
      const content = [...groups.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([, group]) => [group.label, ...group.ids].join("\n"))
        .join("\n\n");
      if (!content) return toast.error("No hay MLA para copiar con esos filtros.");
      await navigator.clipboard.writeText(content);
      toast.success(`${(result.data || []).length} MLA copiados y agrupados por fecha de creación.`);
    } catch {
      toast.error("No se pudieron copiar los MLA. Revisa los filtros y permisos del navegador.");
    }
  };

  const refreshPublicaciones = async () => {
    if (!selectedAccountId) return;
    await loadTab(selectedAccountId, "PUBLICACIONES", pages.PUBLICACIONES, deferredSearch, publicationLinkFilter, publicationDateFilter);
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
    return preguntas.data.filter((pregunta) => [
      pregunta.preguntaId, pregunta.itemId, pregunta.titulo, pregunta.comprador, pregunta.texto, pregunta.respuesta,
      ...pregunta.anteriores.flatMap((anterior) => [anterior.preguntaId, anterior.texto, anterior.respuesta]),
    ].some((value) => String(value || "").toLowerCase().includes(term)));
  }, [preguntas.data, search]);

  const calculateCostPage = async () => {
    if (!selectedAccountId || !visiblePublicaciones.length || calculatingCostPage) return;
    try {
      setCalculatingCostPage(true);
      const response = await fetch("/api/integraciones/mercadolibre/costos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idCuenta: selectedAccountId, itemIds: visiblePublicaciones.map((item) => item.itemId) }),
      });
      const result = await response.json().catch(() => ({})) as { calculados?: MercadoLibreCostoEstimado[]; errores?: Array<{ itemId: string; mensaje: string }>; message?: string };
      if (!response.ok) throw new Error(result.message || "No se pudieron calcular los costos de esta pagina.");
      const costos = new Map((result.calculados || []).map((costo) => [costo.itemId, costo]));
      setPublicaciones((current) => ({ ...current, data: current.data.map((item) => costos.has(item.itemId) ? { ...item, costoEstimado: costos.get(item.itemId)! } : item) }));
      if (result.errores?.length) toast.warning(`${result.calculados?.length || 0} costos actualizados. ${result.errores.length} publicaciones no pudieron calcularse.`);
      else toast.success(`${result.calculados?.length || 0} costos actualizados.`);
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "No se pudieron calcular los costos de esta pagina.");
    } finally {
      setCalculatingCostPage(false);
    }
  };

  const loadCostSync = useCallback(async (accountId: number) => {
    const response = await fetch(`/api/integraciones/mercadolibre/costos/masivo?idCuenta=${accountId}`, { cache: "no-store" });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(result?.message || "No se pudo consultar el avance de Costos ML.");
    setCostSync(result as MercadoLibreCostoSincronizacion | null);
  }, []);

  const updateAllActiveCosts = useCallback(async () => {
    if (!selectedAccountId || massCostSyncInFlight.current) return;
    massCostSyncInFlight.current = true;
    setMassCostSyncing(true);
    try {
      const start = await fetch("/api/integraciones/mercadolibre/costos/masivo", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idCuenta: selectedAccountId }),
      });
      let current = await start.json().catch(() => null) as MercadoLibreCostoSincronizacion | null;
      if (!start.ok || !current) throw new Error((current as unknown as { message?: string } | null)?.message || "No se pudo iniciar Costos ML.");
      setCostSync(current);

      while (current.estado === "EN_PROCESO") {
        const response = await fetch("/api/integraciones/mercadolibre/costos/masivo", {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idCuenta: selectedAccountId }),
        });
        const next = await response.json().catch(() => null) as MercadoLibreCostoSincronizacion | null;
        if (!response.ok || !next) throw new Error((next as unknown as { message?: string } | null)?.message || "No se pudo procesar Costos ML.");
        current = next;
        setCostSync(current);
        if (current.procesadas % 100 === 0 || current.estado === "COMPLETADA") {
          await loadTab(selectedAccountId, "COSTOS", pages.COSTOS, deferredSearch);
        }
      }
      toast.success(`${current.calculadas.toLocaleString("es-AR")} costos activos actualizados.`);
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "No se pudo actualizar Costos ML.");
    } finally {
      massCostSyncInFlight.current = false;
      setMassCostSyncing(false);
    }
  }, [deferredSearch, loadTab, pages.COSTOS, selectedAccountId]);

  useEffect(() => {
    if (!selectedAccountId || tab !== "COSTOS") return;
    void loadCostSync(selectedAccountId).catch(() => setCostSync(null));
  }, [loadCostSync, selectedAccountId, tab]);

  const activeAccount = cuentas.find((account) => account.id === selectedAccountId) || null;
  const activeResult = tab === "VENTAS" ? ventas : tab === "PREGUNTAS" ? preguntas : publicaciones;

  return <main className="min-h-[calc(100dvh-4rem)] bg-slate-50 p-4 dark:bg-slate-950 md:p-6"><div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4">
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800"><div><p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Operaciones</p><h1 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">Mercado Libre</h1></div><div className="flex items-center gap-2"><button type="button" onClick={() => { window.location.href = "/api/integraciones/mercadolibre/conectar"; }} disabled={!canManage || syncing} className="inline-flex h-10 items-center gap-2 rounded-lg border border-yellow-300 bg-yellow-300 px-3 text-xs font-black text-slate-950 transition hover:bg-yellow-200 disabled:cursor-not-allowed disabled:opacity-50"><Link2 className="h-4 w-4" />Conectar cuenta</button>{selectedAccountId && <button type="button" onClick={() => void sync()} disabled={!canManage || syncing} className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-black text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />{syncing ? "Sincronizando" : "Sincronizar"}</button>}</div></header>

    {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300">{error}</div>}
    {!loading && !error && cuentas.length === 0 && <section className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-950"><Unlink className="h-8 w-8 text-slate-400" /><h2 className="mt-4 text-lg font-black text-slate-900 dark:text-white">No hay una cuenta conectada</h2></section>}

    {cuentas.length > 0 && <>
      <section className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950"><label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Cuenta</label><select value={selectedAccountId || ""} onChange={(event) => void selectAccount(Number(event.target.value))} className="h-9 min-w-56 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white">{cuentas.map((cuenta) => <option key={cuenta.id} value={cuenta.id}>{cuenta.nickname || `Vendedor ${cuenta.sellerId}`} · {cuenta.siteId}</option>)}</select>{activeAccount && <span className="text-xs text-slate-500">Ultima sincronizacion: <strong className="text-slate-700 dark:text-slate-200">{date(activeAccount.ultimaSincronizacionAt)}</strong></span>}</section>
      <nav className="flex overflow-x-auto border-b border-slate-200 dark:border-slate-800" aria-label="Secciones de Mercado Libre">{TABS.map((item) => { const Icon = item.icon; const active = tab === item.id; return <button key={item.id} type="button" onClick={() => void changeTab(item.id)} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-xs font-black uppercase tracking-wide transition ${active ? "border-blue-600 text-blue-600 dark:text-blue-300" : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"}`}><Icon className="h-4 w-4" />{item.label}</button>; })}</nav>
      {tab !== "SINCRONIZACION" && <div className="flex flex-wrap items-center gap-2">
        {tab === "PREGUNTAS" && <><label className="sr-only" htmlFor="preguntas-estado">Estado de preguntas</label><select id="preguntas-estado" value={questionStatus} onChange={(event) => changeQuestionFilter("estado", event.target.value)} className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="POR_RESPONDER">Por responder</option><option value="RESPONDIDAS">Respondidas</option></select><label className="sr-only" htmlFor="preguntas-orden">Orden de preguntas</label><select id="preguntas-orden" value={questionOrder} onChange={(event) => changeQuestionFilter("orden", event.target.value)} className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="DESC">Mas nuevas primero</option><option value="ASC">Mas viejas primero</option></select><button type="button" onClick={() => setQuickRepliesOpen(true)} disabled={!canManage} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 px-3 text-xs font-black text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-blue-500/10 dark:hover:text-blue-300"><MessageSquarePlus className="h-4 w-4" />Respuestas rapidas</button></>}
        {tab === "PUBLICACIONES" && <>
          <label className="sr-only" htmlFor="publicaciones-vinculo">Estado de vinculo</label><select id="publicaciones-vinculo" value={publicationLinkFilter} onChange={(event) => changePublicationLinkFilter(event.target.value as PublicationLinkFilter)} className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="">Todas las publicaciones</option><option value="SIN_VINCULO">Sin vinculo</option><option value="EXCLUIDO_MANUAL">No vincular</option></select>
          <label className="sr-only" htmlFor="publicaciones-desde">Creada desde</label><input id="publicaciones-desde" type="date" value={publicationDateFilter.desde} onChange={(event) => changePublicationDateFilter("desde", event.target.value)} className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" title="Creada desde" />
          <label className="sr-only" htmlFor="publicaciones-hasta">Creada hasta</label><input id="publicaciones-hasta" type="date" value={publicationDateFilter.hasta} onChange={(event) => changePublicationDateFilter("hasta", event.target.value)} className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" title="Creada hasta" />
          <button type="button" onClick={() => void copyFilteredPublicationMlas()} disabled={!publicaciones.totalCount} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 px-3 text-xs font-black text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-blue-500/10 dark:hover:text-blue-300" title="Copiar MLA filtrados por fecha de creación"><Copy className="h-4 w-4" />Copiar MLA</button>
        </>}
        <div className="relative min-w-[240px] flex-1"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tab === "VENTAS" ? "Nombre / Usuario ML / Item / SKU / # Venta / Nro. envio" : tab === "PREGUNTAS" ? "Pregunta, cliente, MLA o publicacion" : tab === "COSTOS" ? "MLA, SKU, titulo o codigo IMC" : "Titulo, MLA, SKU o codigo IMC"} className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></div><span className="text-xs font-medium text-slate-500">{activeResult.totalCount.toLocaleString("es-AR")} {tab === "PREGUNTAS" && questionStatus === "RESPONDIDAS" ? "conversaciones" : "registros"}</span>
      </div>}
      {tab === "VENTAS" && salesSyncError && <p className="text-xs font-bold text-red-600 dark:text-red-300">{salesSyncError}</p>}
      {tab === "PREGUNTAS" && questionSyncError && <p className="text-xs font-bold text-red-600 dark:text-red-300">{questionSyncError}</p>}
      {tab === "VENTAS" && <VentasTable ventas={visibleVentas} loading={loading} />}
      {tab === "PUBLICACIONES" && <PublicacionesTable publicaciones={visiblePublicaciones} loading={loading} canManage={canManage} onChanged={refreshPublicaciones} />}
      {tab === "COSTOS" && <CostosTable publicaciones={visiblePublicaciones} loading={loading} calculatingItemId={calculatingCostItemId} calculatingPage={calculatingCostPage} costSync={costSync} massSyncing={massCostSyncing} onCalculate={calculateCost} onCalculatePage={calculateCostPage} onUpdateAll={() => void updateAllActiveCosts()} />}
      {tab === "PREGUNTAS" && <PreguntasTable preguntas={visiblePreguntas} loading={loading} canManage={canManage} quickReplies={quickReplies} answeringQuestionId={answeringQuestionId} onAnswer={answerQuestion} />}
      {tab === "SINCRONIZACION" && <SyncPanel account={activeAccount} onSync={() => void sync()} syncing={syncing} canManage={canManage} />}
      {tab !== "SINCRONIZACION" && activeResult.totalPages > 1 && <div className="flex items-center justify-center gap-3"><button type="button" onClick={() => void changePage(pages[tab] - 1)} disabled={pages[tab] <= 1} className="h-9 rounded-lg border border-slate-300 px-3 text-xs font-black disabled:opacity-40 dark:border-slate-700">Anterior</button><span className="text-xs font-bold text-slate-500">Pagina {pages[tab]} de {activeResult.totalPages}</span><button type="button" onClick={() => void changePage(pages[tab] + 1)} disabled={pages[tab] >= activeResult.totalPages} className="h-9 rounded-lg border border-slate-300 px-3 text-xs font-black disabled:opacity-40 dark:border-slate-700">Siguiente</button></div>}
    </>}
    {quickRepliesOpen && selectedAccountId && <QuickRepliesModal idCuenta={selectedAccountId} onClose={() => setQuickRepliesOpen(false)} onChanged={() => void loadQuickReplies(selectedAccountId)} />}
  </div></main>;
}

function VentasTable({ ventas, loading }: { ventas: MercadoLibreVentasResult["data"]; loading: boolean }) {
  return <TableShell hasRows={ventas.length > 0} empty={loading ? "Cargando ventas..." : "No hay ventas sincronizadas."}><table className="w-full min-w-[1040px] text-left text-[13px] [&_th]:bg-slate-50 [&_th]:px-3 [&_th]:py-3 [&_th]:text-[11px] [&_th]:font-black [&_th]:uppercase [&_th]:tracking-widest [&_th]:text-slate-500 dark:[&_th]:bg-slate-900 [&_td]:border-t [&_td]:border-slate-100 [&_td]:px-3 [&_td]:py-3 dark:[&_td]:border-slate-800"><thead><tr><th>Fecha</th><th>Cliente</th><th>Items</th><th>Envio</th><th>Estado</th><th className="text-right">Total</th></tr></thead><tbody>{ventas.map((venta) => <tr key={venta.id}><td><div className="font-bold text-slate-800 dark:text-white">{date(venta.fecha, "-")}</div><div className="mt-1 font-mono text-[11px] text-slate-500">#{venta.ventaId}</div></td><td className="font-bold text-slate-800 dark:text-white">{venta.comprador || "-"}</td><td><div className="max-w-md space-y-1">{venta.items.map((item, index) => <div key={`${venta.id}-${index}`} className="truncate font-semibold text-slate-700 dark:text-slate-200" title={item.titulo}>{item.cantidad}x {item.titulo}{item.sku && <span className="ml-1 font-mono text-slate-400">[{item.sku}]</span>}</div>)}</div></td><td><div>{venta.retiroEnPersona ? "Retira en persona" : venta.envio || "-"}</div>{venta.numeroEnvio && <div className="mt-1 font-mono text-[11px] text-slate-500">#{venta.numeroEnvio}</div>}</td><td><StateBadge value={venta.estado} /></td><td className="text-right font-mono font-black text-slate-800 dark:text-white">{money(venta.total, venta.moneda)}</td></tr>)}</tbody></table></TableShell>;
}

function PublicacionesTable({ publicaciones, loading, canManage, onChanged }: {
  publicaciones: MercadoLibrePublicacionesResult["data"];
  loading: boolean;
  canManage: boolean;
  onChanged: () => Promise<void>;
}) {
  const [reviewing, setReviewing] = useState<MercadoLibrePublicacionListado | null>(null);

  return <>
    <TableShell hasRows={publicaciones.length > 0} empty={loading ? "Cargando publicaciones..." : "No hay publicaciones sincronizadas."}>
      <table className="w-full min-w-[1210px] text-left text-[13px]">
        <thead><tr><th>Publicacion</th><th>SKU ML</th><th>Estado</th><th>Precio ML</th><th className="text-right">Stock ML</th><th>Fechas</th><th>Vinculo IMC</th><th /></tr></thead>
        <tbody>{publicaciones.map((item) => <tr key={item.id}>
          <td><div className="max-w-md truncate font-black text-slate-900 dark:text-white" title={item.titulo}>{item.titulo}</div><div className="mt-1 font-mono text-[11px] text-slate-500">{item.itemId}</div></td>
          <td className="font-mono font-bold">{item.sellerSku || "-"}</td><td><StateBadge value={item.estado} /></td><td className="font-mono font-black">{money(item.precio, item.moneda)}</td><td className="text-right font-mono font-black">{item.cantidadDisponible ?? "-"}</td>
          <td className="whitespace-nowrap text-[11px] leading-5 text-slate-500 dark:text-slate-300"><div><b>Creada:</b> {date(item.fechaCreacionMl, "-")}</div><div><b>Editada:</b> {date(item.fechaActualizacionMl, "-")}</div><div><b>Sync IMC:</b> {date(item.sincronizadaAt, "-")}</div></td>
          <td><span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${publicationLinkBadge(item.tipoVinculo)}`}>{publicationLinkLabel(item.tipoVinculo)}</span>{(item.codigoProducto || item.codigoKit) && <div className="mt-1 font-mono text-[11px] text-slate-500">{item.codigoProducto || item.codigoKit}</div>}</td>
          <td className="text-right"><div className="flex justify-end gap-1">{canManage && (item.tipoVinculo === "SIN_VINCULO" || item.tipoVinculo === "EXCLUIDO_MANUAL") && <button type="button" onClick={() => setReviewing(item)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-blue-200 px-2 text-[11px] font-black text-blue-700 transition hover:bg-blue-50 dark:border-blue-900/70 dark:text-blue-300 dark:hover:bg-blue-950/30"><Link2 className="h-3.5 w-3.5" />Revisar</button>}{item.permalink && <a href={item.permalink} target="_blank" rel="noreferrer" title="Abrir publicacion" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-blue-600 hover:bg-blue-500/10 dark:text-blue-300"><ExternalLink className="h-4 w-4" /></a>}</div></td>
        </tr>)}</tbody>
      </table>
    </TableShell>
    {reviewing && <VinculoReviewDialog publication={reviewing} onClose={() => setReviewing(null)} onChanged={async () => { setReviewing(null); await onChanged(); }} />}
  </>;
}

function VinculoReviewDialog({ publication, onClose, onChanged }: {
  publication: MercadoLibrePublicacionListado;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [search, setSearch] = useState(publication.sellerSku || "");
  const [candidates, setCandidates] = useState<LinkCandidate[]>([]);
  const [selected, setSelected] = useState<LinkCandidate | null>(null);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updateSku, setUpdateSku] = useState(publication.variaciones.length === 0);
  const hasVariations = publication.variaciones.length > 0;

  useEffect(() => {
    if (selected || search.trim().length < 2) {
      setCandidates([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setLoadingCandidates(true);
        const response = await fetch(`/api/integraciones/mercadolibre/candidatos-vinculo?q=${encodeURIComponent(search.trim())}`, { signal: controller.signal });
        setCandidates(response.ok ? await response.json() : []);
      } catch {
        if (!controller.signal.aborted) setCandidates([]);
      } finally {
        if (!controller.signal.aborted) setLoadingCandidates(false);
      }
    }, 250);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [search, selected]);

  const save = async (target: LinkCandidate | null) => {
    if (!target && !window.confirm("La publicacion quedara marcada como no vincular. Podes revertirlo luego desde esta misma lista.")) return;
    try {
      setSaving(true);
      const response = await fetch(`/api/integraciones/mercadolibre/publicaciones/${publication.id}/vinculo`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: target ? { tipo: target.tipo, id: target.id } : null, actualizarSku: target ? updateSku : false }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "No se pudo guardar el vinculo.");
      toast.success(target ? "Vinculo guardado." : "Publicacion marcada como no vincular.");
      if (target && updateSku && result.skuActualizado) toast.success(`SKU de Mercado Libre actualizado a ${result.sku}.`);
      if (result.advertenciaSku) toast.warning(result.advertenciaSku);
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar el vinculo.");
    } finally {
      setSaving(false);
    }
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4" role="dialog" aria-modal="true" aria-labelledby="vinculo-review-title">
    <div className="max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-lg border border-slate-700 bg-white shadow-2xl dark:bg-slate-950">
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-4 dark:border-slate-800"><div><p className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-300">Revision manual</p><h2 id="vinculo-review-title" className="mt-1 text-base font-black text-slate-900 dark:text-white">Vincular publicacion de Mercado Libre</h2></div><button type="button" onClick={onClose} disabled={saving} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800" title="Cerrar"><X className="h-4 w-4" /></button></header>
      <div className="space-y-4 p-4">
        <div className="border-b border-slate-200 pb-4 dark:border-slate-800"><p className="font-black text-slate-900 dark:text-white">{publication.titulo}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-slate-500"><span>{publication.itemId}</span><span>SKU actual: {publication.sellerSku || "Sin SKU"}</span><span>{publication.variaciones.length ? `${publication.variaciones.length} variaciones` : "Sin variaciones"}</span></div></div>
        {selected ? <div className="flex items-center justify-between gap-3 border border-blue-200 bg-blue-50 p-3 dark:border-blue-900/70 dark:bg-blue-950/25"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-300">Seleccionado: {selected.tipo === "KIT" ? "Grupo / kit" : "Item"}</p><p className="mt-1 truncate font-mono text-sm font-black text-slate-900 dark:text-white">{selected.codigo}</p><p className="truncate text-xs text-slate-600 dark:text-slate-300">{selected.descripcion}</p></div><button type="button" onClick={() => { setSelected(null); setSearch(""); }} disabled={saving} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-blue-700 hover:bg-blue-100 disabled:opacity-50 dark:text-blue-300 dark:hover:bg-blue-900/40" title="Cambiar seleccionado"><X className="h-4 w-4" /></button></div> : <div><label htmlFor="vinculo-candidato" className="text-[10px] font-black uppercase tracking-widest text-slate-500">Buscar item o grupo</label><div className="relative mt-1"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input id="vinculo-candidato" autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Codigo o descripcion" className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" /></div><div className="mt-2 max-h-56 overflow-y-auto border border-slate-200 dark:border-slate-800">{loadingCandidates ? <div className="flex items-center justify-center gap-2 px-3 py-5 text-xs font-semibold text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" />Buscando...</div> : search.trim().length < 2 ? <p className="px-3 py-5 text-center text-xs font-semibold text-slate-500">Escribi al menos dos caracteres.</p> : candidates.length ? candidates.map((candidate) => <button key={`${candidate.tipo}-${candidate.id}`} type="button" onClick={() => setSelected(candidate)} className="flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2.5 text-left transition last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"><span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded text-[10px] font-black ${candidate.tipo === "KIT" ? "bg-orange-500/15 text-orange-700 dark:text-orange-300" : "bg-blue-500/15 text-blue-700 dark:text-blue-300"}`}>{candidate.tipo === "KIT" ? "K" : "I"}</span><span className="min-w-0"><span className="block font-mono text-xs font-black text-slate-900 dark:text-white">{candidate.codigo}</span><span className="block truncate text-xs text-slate-500 dark:text-slate-300">{candidate.descripcion}</span></span></button>) : <p className="px-3 py-5 text-center text-xs font-semibold text-slate-500">No se encontraron items ni grupos.</p>}</div></div>}
        <label className="flex items-start gap-3 border-t border-slate-200 pt-4 text-sm text-slate-700 dark:border-slate-800 dark:text-slate-200"><input type="checkbox" checked={updateSku} disabled={hasVariations || saving} onChange={(event) => setUpdateSku(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50" /><span><b>Actualizar SKU en Mercado Libre</b><span className="mt-0.5 block text-xs text-slate-500">Usa el codigo del item o grupo seleccionado como SKU de esta publicacion.</span>{hasVariations && <span className="mt-1 block text-xs font-semibold text-amber-600 dark:text-amber-300">Esta publicacion tiene variaciones; el SKU debe revisarse por variante en Mercado Libre.</span>}</span></label>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 p-4 dark:border-slate-800"><button type="button" onClick={() => void save(null)} disabled={saving} className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-black text-slate-500 transition hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"><Ban className="h-4 w-4" />No vincular</button><div className="flex gap-2"><button type="button" onClick={onClose} disabled={saving} className="h-9 rounded-lg border border-slate-300 px-3 text-xs font-black text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200">Cancelar</button><button type="button" onClick={() => void save(selected)} disabled={!selected || saving} className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-black text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{saving ? "Guardando" : "Guardar vinculo"}</button></div></footer>
    </div>
  </div>;
}

const GESU_RECARGO_PORCENTAJE = 0.02;

function CostosTable({ publicaciones, loading, calculatingItemId, calculatingPage, costSync, massSyncing, onCalculate, onCalculatePage, onUpdateAll }: {
  publicaciones: MercadoLibrePublicacionesResult["data"];
  loading: boolean;
  calculatingItemId: string | null;
  calculatingPage: boolean;
  costSync: MercadoLibreCostoSincronizacion | null;
  massSyncing: boolean;
  onCalculate: (itemId: string) => void;
  onCalculatePage: () => void;
  onUpdateAll: () => void;
}) {
  const progress = costSync?.total ? Math.min(100, Math.round((costSync.procesadas / costSync.total) * 100)) : 0;
  return <div className="space-y-2">
    <div className="flex flex-wrap items-center justify-between gap-3 px-1">
      <p className="text-xs font-semibold text-slate-500">El <b className="text-slate-700 dark:text-slate-200">+2% Gesu</b> es un recargo de precio, no un cargo de Mercado Libre.</p>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={onCalculatePage} disabled={!publicaciones.length || calculatingPage || massSyncing} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 px-3 text-xs font-black text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"><RefreshCw className={`h-4 w-4 ${calculatingPage ? "animate-spin" : ""}`} />Pagina ({publicaciones.length})</button><button type="button" onClick={onUpdateAll} disabled={massSyncing} className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-black text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${massSyncing ? "animate-spin" : ""}`} />{massSyncing ? "Actualizando activas..." : costSync?.estado === "EN_PROCESO" ? "Continuar activas" : "Actualizar activas"}</button></div>
    </div>
    {costSync && <div className="border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-950"><div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1"><span className="font-bold text-slate-700 dark:text-slate-200">{costSync.estado === "COMPLETADA" ? "Ultima actualizacion completada" : "Actualizacion pendiente"}</span><span className="font-mono text-slate-500">{costSync.procesadas.toLocaleString("es-AR")} / {costSync.total.toLocaleString("es-AR")} · {costSync.calculadas.toLocaleString("es-AR")} calculadas · {costSync.fallidas.toLocaleString("es-AR")} con error</span></div><div className="mt-2 h-1.5 overflow-hidden bg-slate-100 dark:bg-slate-800"><div className="h-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} /></div></div>}
    <TableShell hasRows={publicaciones.length > 0} empty={loading ? "Cargando publicaciones..." : "No hay publicaciones sincronizadas."}>
    <table className="w-full table-fixed text-left text-[13px]">
      <thead><tr><th>Publicacion</th><th className="text-right">Precio</th><th className="text-right">Comision ML</th><th className="text-right">Envio est.</th><th className="text-right">+2% Gesu</th><th className="text-right">Resultado</th><th /></tr></thead>
      <tbody>{publicaciones.map((item) => {
        const costo = item.costoEstimado;
        const calculating = calculatingItemId === item.itemId;
        const recargoGesu = item.precio === null ? null : item.precio * GESU_RECARGO_PORCENTAJE;
        const precioConRecargoGesu = item.precio === null || recargoGesu === null ? null : item.precio + recargoGesu;
        return <tr key={item.id}>
          <td><div className="max-w-[22rem] truncate font-black text-slate-900 dark:text-white" title={item.titulo}>{item.titulo}</div><div className="mt-1 flex flex-wrap gap-x-2 font-mono text-[11px] text-slate-500"><span>{item.itemId}</span><span>{item.sellerSku || item.codigoProducto || item.codigoKit || "-"}</span><span>{item.tipoPublicacion || "-"}</span></div>{costo?.advertencias?.[0] && <div className="mt-1 max-w-sm truncate text-[11px] font-semibold text-amber-600 dark:text-amber-300" title={costo.advertencias.join(" ")}>{costo.advertencias[0]}</div>}</td>
          <td className="text-right font-mono font-black">{money(item.precio, item.moneda)}</td>
          <td className="text-right font-mono"><div>{money(costo?.comisionTotal ?? null, item.moneda)}</div><div className="mt-1 text-[11px] text-slate-500">Fijo {money(costo?.cargoFijo ?? null, item.moneda)} · Cuotas {money(costo?.cargoFinanciacion ?? null, item.moneda)}</div></td>
          <td className="text-right font-mono"><div>{money(costo?.envioEstimado ?? null, item.moneda)}</div>{costo?.pesoFacturable !== null && costo?.pesoFacturable !== undefined && <div className="mt-1 text-[11px] text-slate-500">{costo.pesoFacturable} g fact.</div>}{costo?.dimensionesEnvio && <div className="mt-1 max-w-28 truncate text-[11px] text-slate-500" title={`Dimensiones ML: ${costo.dimensionesEnvio}`}>ML: {costo.dimensionesEnvio}</div>}</td>
          <td className="text-right font-mono"><div className="font-black text-violet-600 dark:text-violet-300">{money(recargoGesu, item.moneda)}</div><div className="mt-1 whitespace-nowrap text-[11px] text-slate-500">P. Gesu {money(precioConRecargoGesu, item.moneda)}</div></td>
          <td className="text-right font-mono"><div className="font-black text-red-600 dark:text-red-300">ML {money(costo?.costoMlTotal ?? null, item.moneda)}</div><div className="mt-1 font-black text-emerald-600 dark:text-emerald-300">Neto {money(costo?.netoEstimado ?? null, item.moneda)}</div><div className="mt-1 whitespace-nowrap text-[11px] font-semibold text-slate-500">{costo?.consultadoAt ? date(costo.consultadoAt, "-") : "Sin calcular"}</div></td>
          <td className="text-right"><button type="button" onClick={() => onCalculate(item.itemId)} disabled={calculating} title="Actualizar costo estimado" aria-label={`Actualizar costo estimado de ${item.titulo}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-blue-600 transition hover:bg-blue-500/10 disabled:opacity-50 dark:text-blue-300"><RefreshCw className={`h-4 w-4 ${calculating ? "animate-spin" : ""}`} /></button></td>
        </tr>;
      })}</tbody>
    </table>
    </TableShell>
  </div>;
}

function PreguntasTable({ preguntas, loading, canManage, quickReplies, answeringQuestionId, onAnswer }: {
  preguntas: MercadoLibrePreguntasResult["data"];
  loading: boolean;
  canManage: boolean;
  quickReplies: QuickReply[];
  answeringQuestionId: string | null;
  onAnswer: (preguntaId: string, texto: string) => Promise<void>;
}) {
  return <section className="space-y-3">{preguntas.length ? preguntas.map((pregunta) => pregunta.estado === "ANSWERED" ? <PreguntaRespondidaAgrupadaCard key={pregunta.id} pregunta={pregunta} /> : <PreguntaCard key={pregunta.id} pregunta={pregunta} canManage={canManage} quickReplies={quickReplies} sending={answeringQuestionId === pregunta.preguntaId} onAnswer={onAnswer} />) : <TableShell hasRows={false} empty={loading ? "Cargando preguntas..." : "No hay preguntas sincronizadas."}>{null}</TableShell>}</section>;
}

function PreguntaRespondidaAgrupadaCard({ pregunta }: { pregunta: MercadoLibrePreguntasResult["data"][number] }) {
  const [expanded, setExpanded] = useState(false);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const conversaciones = [
    { preguntaId: pregunta.preguntaId, texto: pregunta.texto, fecha: pregunta.fecha, respuesta: pregunta.respuesta, respondidaAt: pregunta.respondidaAt, estado: pregunta.estado },
    ...pregunta.anteriores,
  ].sort((a, b) => new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime());
  const ultima = conversaciones[0];

  return <article className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
    <header className="grid gap-3 p-4 sm:grid-cols-[3rem_minmax(0,1fr)_auto_auto] sm:items-center">
      <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">{pregunta.thumbnailUrl && !thumbnailFailed ? <img src={pregunta.thumbnailUrl} alt="" className="h-full w-full object-contain" onError={() => setThumbnailFailed(true)} /> : <Package className="h-5 w-5 text-slate-400" />}</div>
      <div className="min-w-0"><p className="font-mono text-[10px] font-bold uppercase text-slate-500">{pregunta.sellerSku ? `SKU ${pregunta.sellerSku}` : pregunta.itemId || "Publicacion"}</p><p className="truncate text-sm font-black text-slate-900 dark:text-white" title={pregunta.titulo || ""}>{pregunta.titulo || pregunta.itemId || "Sin titulo"}</p></div>
      <div className="text-sm font-black text-slate-800 dark:text-white">{money(pregunta.precio, pregunta.moneda)}</div>
      <div className="text-sm font-bold text-slate-500">{pregunta.cantidadDisponible === null ? "" : `${pregunta.cantidadDisponible} unidades`}</div>
    </header>
    <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} className="grid w-full gap-2 border-t border-slate-200 px-4 py-3 text-left transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900/60 sm:grid-cols-[minmax(9rem,0.8fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center">
      <div className="flex min-w-0 items-center gap-2 text-xs text-slate-500"><span className="truncate font-bold text-slate-800 dark:text-white">{pregunta.comprador || "Cliente"}</span><span className="shrink-0">{date(ultima.fecha, "-")}</span></div>
      <p className="truncate text-sm font-semibold text-slate-900 dark:text-white" title={ultima.texto}>{ultima.texto}</p>
      <p className="truncate text-sm text-slate-500 dark:text-slate-300" title={ultima.respuesta || "Sin respuesta disponible"}>{ultima.respuesta || "Sin respuesta disponible"}</p>
      <span className="flex items-center justify-end gap-2 text-xs font-black text-blue-600 dark:text-blue-300">{conversaciones.length} {conversaciones.length === 1 ? "pregunta" : "preguntas"}{expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</span>
    </button>
    {expanded && <ol className="divide-y divide-slate-200 border-t border-slate-200 dark:divide-slate-800 dark:border-slate-800">{conversaciones.map((conversacion) => <li key={conversacion.preguntaId} className="p-4"><div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500"><span className="font-bold text-slate-800 dark:text-white">{pregunta.comprador || "Cliente"}</span><span>{date(conversacion.fecha, "-")}</span><StateBadge value={conversacion.estado} /></div><p className="mt-2 text-sm font-bold text-slate-900 dark:text-white">{conversacion.texto}</p><p className="mt-3 border-l-2 border-blue-500 pl-3 text-sm text-slate-600 dark:text-slate-300">{conversacion.respuesta || "Sin respuesta disponible"}</p></li>)}</ol>}
  </article>;
}

function PreguntaCard({ pregunta, canManage, quickReplies, sending, onAnswer }: {
  pregunta: MercadoLibrePreguntasResult["data"][number];
  canManage: boolean;
  quickReplies: QuickReply[];
  sending: boolean;
  onAnswer: (preguntaId: string, texto: string) => Promise<void>;
}) {
  const [texto, setTexto] = useState("");
  const [showPrevious, setShowPrevious] = useState(false);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const respond = async () => { await onAnswer(pregunta.preguntaId, texto); setTexto(""); };
  return <article className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
    <header className="grid gap-3 p-4 sm:grid-cols-[3rem_minmax(0,1fr)_auto_auto] sm:items-center">
      <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">{pregunta.thumbnailUrl && !thumbnailFailed ? <img src={pregunta.thumbnailUrl} alt="" className="h-full w-full object-contain" onError={() => setThumbnailFailed(true)} /> : <Package className="h-5 w-5 text-slate-400" />}</div>
      <div className="min-w-0"><p className="font-mono text-[10px] font-bold uppercase text-slate-500">{pregunta.sellerSku ? `SKU ${pregunta.sellerSku}` : pregunta.itemId || "Publicacion"}</p><p className="truncate text-sm font-black text-slate-900 dark:text-white" title={pregunta.titulo || ""}>{pregunta.titulo || pregunta.itemId || "Sin titulo"}</p></div>
      <div className="text-sm font-black text-slate-800 dark:text-white">{money(pregunta.precio, pregunta.moneda)}</div>
      <div className="text-sm font-bold text-slate-500">{pregunta.cantidadDisponible === null ? "" : `${pregunta.cantidadDisponible} unidades`}</div>
    </header>
    <div className="border-t border-slate-200 px-4 py-4 dark:border-slate-800">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500"><span className="font-bold text-slate-800 dark:text-white">{pregunta.comprador || "Cliente"}</span><span>{date(pregunta.fecha, "-")}</span><StateBadge value={pregunta.estado} /></div>
      <p className="mt-2 text-sm font-bold text-slate-900 dark:text-white">{pregunta.texto}</p>
      {pregunta.estado === "UNANSWERED" ? <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"><div>{quickReplies.length > 0 && <select defaultValue="" disabled={!canManage || sending} onChange={(event) => { const reply = quickReplies.find((item) => String(item.id) === event.target.value); if (reply) setTexto(reply.texto); event.currentTarget.value = ""; }} className="mb-2 h-8 max-w-full rounded-md border border-slate-300 bg-white px-2 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><option value="">Respuestas rapidas</option>{quickReplies.map((reply) => <option key={reply.id} value={reply.id}>{reply.nombre}</option>)}</select>}<textarea value={texto} onChange={(event) => setTexto(event.target.value)} maxLength={2000} disabled={!canManage || sending} placeholder="Escribi la respuesta" className="min-h-24 w-full resize-y rounded-md border border-slate-300 bg-white p-3 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /><span className="mt-1 block text-right text-[10px] font-medium text-slate-400">{texto.length}/2000</span></div><button type="button" disabled={!canManage || sending || !texto.trim()} onClick={() => void respond()} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-xs font-black text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"><Send className="h-4 w-4" />{sending ? "Enviando" : "Responder"}</button></div> : <div className="mt-3 border-l-2 border-blue-500 pl-3 text-sm text-slate-600 dark:text-slate-300">{pregunta.respuesta || "Sin respuesta disponible"}</div>}
      {pregunta.anteriores.length > 0 && <div className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-800"><button type="button" onClick={() => setShowPrevious((value) => !value)} className="inline-flex items-center gap-2 text-xs font-black text-blue-600 hover:text-blue-500 dark:text-blue-300">{showPrevious ? "Ocultar preguntas anteriores" : `Ver preguntas anteriores (${pregunta.anteriores.length})`}{showPrevious ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button>{showPrevious && <ol className="mt-3 space-y-3">{pregunta.anteriores.map((anterior) => <li key={anterior.preguntaId} className="border-l-2 border-slate-200 pl-3 text-sm dark:border-slate-700"><div className="flex flex-wrap gap-x-2 text-xs text-slate-500"><span>{date(anterior.fecha, "-")}</span><StateBadge value={anterior.estado} /></div><p className="mt-1 font-semibold text-slate-800 dark:text-slate-100">{anterior.texto}</p>{anterior.respuesta && <p className="mt-1 text-slate-500 dark:text-slate-300">{anterior.respuesta}</p>}</li>)}</ol>}</div>}
    </div>
  </article>;
}

function QuickRepliesModal({ idCuenta, onClose, onChanged }: { idCuenta: number; onClose: () => void; onChanged: () => void }) {
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [editing, setEditing] = useState<QuickReply | null>(null);
  const [nombre, setNombre] = useState("");
  const [texto, setTexto] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadReplies = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/integraciones/mercadolibre/respuestas-rapidas?idCuenta=${idCuenta}`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      setReplies(await response.json());
    } catch {
      toast.error("No se pudieron cargar las respuestas rapidas.");
    } finally { setLoading(false); }
  }, [idCuenta]);

  useEffect(() => { void loadReplies(); }, [loadReplies]);
  const resetForm = () => { setEditing(null); setNombre(""); setTexto(""); };
  const edit = (reply: QuickReply) => { setEditing(reply); setNombre(reply.nombre); setTexto(reply.texto); };
  const save = async () => {
    try {
      setSaving(true);
      const response = await fetch(editing ? `/api/integraciones/mercadolibre/respuestas-rapidas/${editing.id}?idCuenta=${idCuenta}` : `/api/integraciones/mercadolibre/respuestas-rapidas?idCuenta=${idCuenta}`, {
        method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre, texto }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "No se pudo guardar la respuesta.");
      toast.success(editing ? "Respuesta actualizada." : "Respuesta rapida creada.");
      resetForm(); await loadReplies(); onChanged();
    } catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo guardar la respuesta."); }
    finally { setSaving(false); }
  };
  const remove = async (reply: QuickReply) => {
    if (!window.confirm(`Eliminar la respuesta rapida "${reply.nombre}"?`)) return;
    try {
      const response = await fetch(`/api/integraciones/mercadolibre/respuestas-rapidas/${reply.id}?idCuenta=${idCuenta}`, { method: "DELETE" });
      if (!response.ok) throw new Error("No se pudo eliminar la respuesta.");
      toast.success("Respuesta eliminada."); await loadReplies(); onChanged();
    } catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo eliminar la respuesta."); }
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4" role="dialog" aria-modal="true" aria-labelledby="quick-replies-title"><div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-slate-700 bg-white shadow-2xl dark:bg-slate-950"><header className="flex items-start justify-between gap-4 border-b border-slate-200 p-4 dark:border-slate-800"><div><p className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-300">Preguntas</p><h2 id="quick-replies-title" className="mt-1 text-base font-black text-slate-900 dark:text-white">Respuestas rapidas</h2></div><button type="button" onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" title="Cerrar"><X className="h-4 w-4" /></button></header><div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"><section className="space-y-2"><div className="flex items-center justify-between"><h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Guardadas</h3><button type="button" onClick={resetForm} className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 px-2 text-[10px] font-black text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"><Plus className="h-3.5 w-3.5" />Nueva</button></div>{loading ? <p className="py-8 text-center text-xs font-semibold text-slate-500">Cargando...</p> : replies.length ? <div className="divide-y divide-slate-200 border border-slate-200 dark:divide-slate-800 dark:border-slate-800">{replies.map((reply) => <div key={reply.id} className="flex gap-2 p-3"><button type="button" onClick={() => edit(reply)} className="min-w-0 flex-1 text-left"><p className="truncate text-xs font-black text-slate-900 dark:text-white">{reply.nombre}</p><p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-300">{reply.texto}</p></button><button type="button" onClick={() => edit(reply)} className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" title="Editar"><Pencil className="h-3.5 w-3.5" /></button><button type="button" onClick={() => void remove(reply)} className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/30" title="Eliminar"><Trash2 className="h-3.5 w-3.5" /></button></div>)}</div> : <p className="border border-dashed border-slate-300 px-3 py-8 text-center text-xs font-semibold text-slate-500 dark:border-slate-700">Todavia no hay respuestas guardadas.</p>}</section><section className="space-y-3"><h3 className="text-xs font-black uppercase tracking-widest text-slate-500">{editing ? "Editar respuesta" : "Nueva respuesta"}</h3><div><label htmlFor="quick-reply-name" className="text-[10px] font-black uppercase tracking-widest text-slate-500">Nombre</label><input id="quick-reply-name" value={nombre} onChange={(event) => setNombre(event.target.value)} maxLength={80} placeholder="Ej. Pedir chasis" className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" /></div><div><label htmlFor="quick-reply-text" className="text-[10px] font-black uppercase tracking-widest text-slate-500">Respuesta</label><textarea id="quick-reply-text" value={texto} onChange={(event) => setTexto(event.target.value)} maxLength={2000} placeholder="Texto que se insertara en la respuesta" className="mt-1 min-h-40 w-full resize-y rounded-lg border border-slate-300 bg-white p-3 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" /><p className="mt-1 text-right text-[10px] text-slate-400">{texto.length}/2000</p></div><div className="flex justify-end gap-2"><button type="button" onClick={resetForm} className="h-9 rounded-lg border border-slate-300 px-3 text-xs font-black text-slate-700 dark:border-slate-700 dark:text-slate-200">Cancelar</button><button type="button" onClick={() => void save()} disabled={saving || !nombre.trim() || !texto.trim()} className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-black text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{saving ? "Guardando" : "Guardar"}</button></div></section></div></div></div>;
}

function SyncPanel({ account, onSync, syncing, canManage }: { account: MercadoLibreCuentaEstado | null; onSync: () => void; syncing: boolean; canManage: boolean }) {
  return <section className="grid gap-4 lg:grid-cols-2"><div className="border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950"><div className="flex items-start gap-3"><ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-300" /><div><h2 className="text-sm font-black text-slate-900 dark:text-white">Sincronizacion de solo lectura</h2><p className="mt-1 text-sm leading-6 text-slate-500">IMC importa publicaciones, ventas y preguntas. No modifica precios, stock ni publicaciones en Mercado Libre.</p></div></div><button type="button" onClick={onSync} disabled={!canManage || syncing} className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-black text-white transition hover:bg-blue-500 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />{syncing ? "Sincronizando" : "Sincronizar ahora"}</button></div><div className="border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950"><h2 className="text-sm font-black text-slate-900 dark:text-white">Estado de cuenta</h2><dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-4"><dt className="text-slate-500">Cuenta</dt><dd className="font-bold text-slate-800 dark:text-white">{account?.nickname || "-"}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Ultima sincronizacion</dt><dd className="font-bold text-slate-800 dark:text-white">{date(account?.ultimaSincronizacionAt || null)}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Resultado</dt><dd className="font-bold text-slate-800 dark:text-white">{account?.ultimoEstadoSincronizacion || "Sin ejecuciones"}</dd></div></dl>{account?.ultimoErrorSincronizacion && <p className="mt-4 border-t border-red-100 pt-3 text-xs font-semibold text-red-600 dark:border-red-950 dark:text-red-300">{account.ultimoErrorSincronizacion}</p>}</div></section>;
}

function TableShell({ children, empty, hasRows }: { children: React.ReactNode; empty: string; hasRows: boolean }) {
  return <section className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 [&_thead]:bg-slate-50 dark:[&_thead]:bg-slate-900 [&_th]:px-3 [&_th]:py-3 [&_th]:text-[11px] [&_th]:font-black [&_th]:uppercase [&_th]:tracking-widest [&_th]:text-slate-500 [&_td]:border-t [&_td]:border-slate-100 [&_td]:px-3 [&_td]:py-3 dark:[&_td]:border-slate-800"><div className="overflow-x-auto">{hasRows ? children : <div className="px-4 py-16 text-center text-sm font-semibold text-slate-400">{empty}</div>}</div></section>;
}

function StateBadge({ value }: { value: string }) {
  return <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-200">{value}</span>;
}
