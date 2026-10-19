"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight, LoaderCircle, RefreshCw, Search, X } from "lucide-react";
import { toast } from "sonner";
import type { MercadoLibreCuentaEstado } from "@/interfaces/mercadolibre";

type Estado = "PENDIENTE" | "CONFIRMADA" | "DESCARTADA" | "TODAS";
type Candidata = {
  id: number;
  preguntaId: number;
  itemId: string | null;
  idProducto: number | null;
  idKit: number | null;
  idPieza: number | null;
  codigoPieza: number | null;
  tituloPublicacion: string | null;
  pregunta: string;
  respuestaHistorica: string | null;
  chasisDetectado: string | null;
  chasisConfirmado: string | null;
  vehiculo: string | null;
  motor: string | null;
  notas: string | null;
  estado: Exclude<Estado, "TODAS">;
  analizadoAt: string;
  revisadoAt: string | null;
};
type Result = {
  data: Candidata[];
  totalCount: number;
  totalPages: number;
  page: number;
  resumen: { pendientes: number; confirmadas: number; descartadas: number };
};
type Props = { canManage: boolean };

const initialResult: Result = { data: [], totalCount: 0, totalPages: 0, page: 1, resumen: { pendientes: 0, confirmadas: 0, descartadas: 0 } };

function date(value: string | null) {
  return value ? new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "-";
}

function estadoClass(estado: Candidata["estado"]) {
  if (estado === "CONFIRMADA") return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (estado === "DESCARTADA") return "bg-slate-500/10 text-slate-600 dark:text-slate-300";
  return "bg-amber-500/10 text-amber-700 dark:text-amber-300";
}

export function CatalogoCompatibilidadesPage({ canManage }: Props) {
  const [accounts, setAccounts] = useState<MercadoLibreCuentaEstado[]>([]);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [estado, setEstado] = useState<Estado>("PENDIENTE");
  const [search, setSearch] = useState("");
  const [searchApplied, setSearchApplied] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Result>(initialResult);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  const loadAccounts = useCallback(async () => {
    const response = await fetch("/api/integraciones/mercadolibre/estado", { cache: "no-store" });
    if (!response.ok) throw new Error("No se pudieron cargar las cuentas de Mercado Libre.");
    const body = await response.json() as { cuentas?: MercadoLibreCuentaEstado[] };
    const nextAccounts = body.cuentas || [];
    setAccounts(nextAccounts);
    setAccountId((current) => current && nextAccounts.some((account) => account.id === current) ? current : nextAccounts[0]?.id ?? null);
  }, []);

  const loadCandidates = useCallback(async () => {
    if (!accountId) {
      setResult(initialResult);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const params = new URLSearchParams({ idCuenta: String(accountId), estado, page: String(page) });
      if (searchApplied.trim()) params.set("q", searchApplied.trim());
      const response = await fetch(`/api/compatibilidades?${params.toString()}`, { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "No se pudo cargar el catalogo de compatibilidades.");
      setResult(body as Result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cargar el catalogo de compatibilidades.");
    } finally {
      setLoading(false);
    }
  }, [accountId, estado, page, searchApplied]);

  useEffect(() => { void loadAccounts().catch((error) => toast.error(error instanceof Error ? error.message : "No se pudieron cargar las cuentas de Mercado Libre.")); }, [loadAccounts]);
  useEffect(() => { void loadCandidates(); }, [loadCandidates]);

  const analyze = async () => {
    if (!accountId) return;
    try {
      setAnalyzing(true);
      const response = await fetch(`/api/compatibilidades?idCuenta=${accountId}`, { method: "POST" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "No se pudieron analizar las preguntas historicas.");
      toast.success(`${body.analizadas || 0} preguntas analizadas: ${body.nuevas || 0} candidatas nuevas.`);
      setPage(1);
      await loadCandidates();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron analizar las preguntas historicas.");
    } finally {
      setAnalyzing(false);
    }
  };

  const changeEstado = (next: Estado) => { setEstado(next); setPage(1); };

  return <main className="min-h-[calc(100dvh-4rem)] bg-slate-50 p-4 dark:bg-slate-950 md:p-6">
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
        <div><p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Mercado Libre</p><h1 className="mt-2 text-2xl font-black text-slate-900 dark:text-white">Catalogo de compatibilidades</h1><p className="mt-1 text-sm font-medium text-slate-500">Candidatos obtenidos de preguntas y respuestas historicas.</p></div>
        {canManage && <button type="button" onClick={() => void analyze()} disabled={!accountId || analyzing} className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-3 text-[11px] font-black uppercase tracking-wide text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${analyzing ? "animate-spin" : ""}`} />{analyzing ? "Analizando" : "Analizar preguntas"}</button>}
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <label className="block max-w-sm"><span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">Cuenta</span><select value={accountId ?? ""} onChange={(event) => { setAccountId(Number(event.target.value) || null); setPage(1); }} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="">Seleccionar cuenta</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.nickname || `Cuenta ${account.id}`} · {account.siteId}</option>)}</select></label>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {([ ["PENDIENTE", "Pendientes", result.resumen.pendientes, "border-amber-500/35 bg-amber-500/5 text-amber-700 dark:text-amber-300"], ["CONFIRMADA", "Confirmadas", result.resumen.confirmadas, "border-emerald-500/35 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300"], ["DESCARTADA", "Descartadas", result.resumen.descartadas, "border-slate-500/35 bg-slate-500/5 text-slate-700 dark:text-slate-300"] ] as const).map(([value, label, count, activeClass]) => <button key={value} type="button" onClick={() => changeEstado(value)} className={`rounded-lg border p-4 text-left transition ${estado === value ? activeClass : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"}`}><span className="block text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</span><span className="mt-1 block text-2xl font-black text-slate-900 dark:text-white">{count.toLocaleString("es-AR")}</span></button>)}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"><form onSubmit={(event) => { event.preventDefault(); setSearchApplied(search); setPage(1); }} className="flex flex-wrap gap-2"><label className="relative min-w-[260px] flex-1"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Publicacion, chasis, vehiculo o texto" className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label><button type="submit" className="h-10 rounded-lg bg-blue-600 px-4 text-[10px] font-black uppercase tracking-wide text-white hover:bg-blue-500">Buscar</button><button type="button" onClick={() => { setSearch(""); setSearchApplied(""); setEstado("PENDIENTE"); setPage(1); }} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-slate-500 hover:border-red-400 hover:text-red-500 dark:border-slate-700" title="Limpiar filtros"><X className="h-4 w-4" /></button></form></section>

      <section className="space-y-3">{loading ? <div className="flex min-h-48 items-center justify-center text-sm font-semibold text-slate-500"><LoaderCircle className="mr-2 h-4 w-4 animate-spin" />Cargando catalogo...</div> : !accountId ? <div className="border border-dashed border-slate-300 p-12 text-center text-sm font-semibold text-slate-500 dark:border-slate-700">Selecciona una cuenta para revisar sus preguntas.</div> : result.data.length === 0 ? <div className="border border-dashed border-slate-300 p-12 text-center text-sm font-semibold text-slate-500 dark:border-slate-700">No hay candidatos para estos filtros.</div> : result.data.map((candidate) => <CompatibilidadCard key={candidate.id} candidate={candidate} idCuenta={accountId} canManage={canManage} onSaved={() => void loadCandidates()} />)}</section>

      <footer className="flex items-center justify-between border-t border-slate-200 pt-3 dark:border-slate-800"><span className="text-xs font-bold text-slate-500">{result.totalCount.toLocaleString("es-AR")} candidatos · Pagina {result.page} de {Math.max(result.totalPages, 1)}</span><div className="flex gap-2"><button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={loading || page <= 1} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300" title="Pagina anterior"><ChevronLeft className="h-4 w-4" /></button><button type="button" onClick={() => setPage((current) => Math.min(Math.max(result.totalPages, 1), current + 1))} disabled={loading || page >= result.totalPages} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300" title="Pagina siguiente"><ChevronRight className="h-4 w-4" /></button></div></footer>
    </div>
  </main>;
}

function CompatibilidadCard({ candidate, idCuenta, canManage, onSaved }: { candidate: Candidata; idCuenta: number; canManage: boolean; onSaved: () => void }) {
  const [chasis, setChasis] = useState(candidate.chasisConfirmado || candidate.chasisDetectado || "");
  const [vehiculo, setVehiculo] = useState(candidate.vehiculo || "");
  const [motor, setMotor] = useState(candidate.motor || "");
  const [notas, setNotas] = useState(candidate.notas || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setChasis(candidate.chasisConfirmado || candidate.chasisDetectado || ""); setVehiculo(candidate.vehiculo || ""); setMotor(candidate.motor || ""); setNotas(candidate.notas || ""); }, [candidate]);

  const save = async (estado: Candidata["estado"]) => {
    try {
      setSaving(true);
      const response = await fetch(`/api/compatibilidades/${candidate.id}?idCuenta=${idCuenta}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ estado, chasisConfirmado: chasis, vehiculo, motor, notas }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "No se pudo guardar la revision.");
      toast.success(estado === "CONFIRMADA" ? "Compatibilidad confirmada." : estado === "DESCARTADA" ? "Candidata descartada." : "Candidata restaurada.");
      onSaved();
    } catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo guardar la revision."); }
    finally { setSaving(false); }
  };

  return <article className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"><header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 p-4 dark:border-slate-800"><div className="min-w-0"><p className="font-mono text-[10px] font-black uppercase text-slate-500">{candidate.codigoPieza ? `Pieza ${candidate.codigoPieza}` : candidate.itemId || "Publicacion sin vinculo"}</p><h2 className="mt-1 text-sm font-black text-slate-900 dark:text-white">{candidate.tituloPublicacion || "Sin titulo de publicacion"}</h2></div><div className="flex items-center gap-2"><span className={`rounded-md px-2 py-1 text-[10px] font-black uppercase ${estadoClass(candidate.estado)}`}>{candidate.estado}</span><span className="text-[10px] font-semibold text-slate-500">{date(candidate.analizadoAt)}</span></div></header><div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]"><section className="space-y-3"><div><p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Pregunta</p><p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{candidate.pregunta}</p></div><div className="border-l-2 border-blue-500 pl-3"><p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Respuesta historica</p><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{candidate.respuestaHistorica || "Sin respuesta registrada"}</p></div></section><section className="grid gap-3 sm:grid-cols-2"><label><span className="text-[10px] font-black uppercase tracking-wide text-slate-500">Chasis o VIN</span><input value={chasis} onChange={(event) => setChasis(event.target.value.toUpperCase())} disabled={!canManage || saving} maxLength={40} className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3 font-mono text-xs font-bold text-slate-900 outline-none focus:border-blue-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label><label><span className="text-[10px] font-black uppercase tracking-wide text-slate-500">Vehiculo</span><input value={vehiculo} onChange={(event) => setVehiculo(event.target.value)} disabled={!canManage || saving} maxLength={180} className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900 outline-none focus:border-blue-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label><label><span className="text-[10px] font-black uppercase tracking-wide text-slate-500">Motor</span><input value={motor} onChange={(event) => setMotor(event.target.value)} disabled={!canManage || saving} maxLength={120} className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900 outline-none focus:border-blue-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label><label><span className="text-[10px] font-black uppercase tracking-wide text-slate-500">Notas</span><input value={notas} onChange={(event) => setNotas(event.target.value)} disabled={!canManage || saving} maxLength={1000} className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900 outline-none focus:border-blue-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label><div className="flex flex-wrap gap-2 sm:col-span-2">{canManage && candidate.estado !== "CONFIRMADA" && <button type="button" onClick={() => void save("CONFIRMADA")} disabled={saving} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-emerald-600 px-3 text-[10px] font-black uppercase tracking-wide text-white hover:bg-emerald-500 disabled:opacity-50"><Check className="h-3.5 w-3.5" /> Confirmar</button>}{canManage && candidate.estado !== "DESCARTADA" && <button type="button" onClick={() => void save("DESCARTADA")} disabled={saving} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 px-3 text-[10px] font-black uppercase tracking-wide text-slate-600 hover:border-red-400 hover:text-red-500 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"><X className="h-3.5 w-3.5" /> Descartar</button>}{canManage && candidate.estado !== "PENDIENTE" && <button type="button" onClick={() => void save("PENDIENTE")} disabled={saving} className="h-9 rounded-md border border-slate-300 px-3 text-[10px] font-black uppercase tracking-wide text-slate-600 hover:border-blue-400 hover:text-blue-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300">Volver a revisar</button>}</div></section></div></article>;
}
