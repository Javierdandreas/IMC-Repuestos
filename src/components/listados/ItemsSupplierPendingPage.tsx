"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { Check, ChevronLeft, ChevronRight, Link2, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useMetadata } from "@/context/MetadataContext";
import { usePermissions } from "@/components/auth/usePermissions";
import { useAppError } from "@/context/AppErrorContext";

type Tipo = "SIN_PROVEEDOR" | "SIN_CODIGO";
type Fila = {
  idProducto: number;
  codigo: string;
  descripcion: string;
  marca: string | null;
  categoria: string | null;
  subcategoria: string | null;
  idProveedor: number | null;
  proveedor: string | null;
  precioLista: number | null;
  costoNeto: number | null;
};
type Result = { data: Fila[]; totalCount: number; totalPages: number; page: number };

const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || "No se pudo cargar el listado.");
  return body as Result;
};

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });

export function ItemsSupplierPendingPage() {
  const { proveedores } = useMetadata();
  const { canManage } = usePermissions();
  const { showError } = useAppError();
  const [tipo, setTipo] = useState<Tipo>("SIN_PROVEEDOR");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [providerToAssign, setProviderToAssign] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [savingCode, setSavingCode] = useState<number | null>(null);
  const [codeDrafts, setCodeDrafts] = useState<Record<string, string>>({});

  const endpoint = useMemo(() => `/api/listados/proveedores-pendientes?tipo=${tipo}&page=${page}&limit=50&q=${encodeURIComponent(search)}`, [page, search, tipo]);
  const { data, error, isLoading, mutate } = useSWR<Result>(endpoint, fetcher);
  const rows = data?.data || [];
  const selectedOnPage = rows.filter((row) => selected.has(row.idProducto)).length;

  useEffect(() => {
    setPage(1);
    setSelected(new Set());
    setCodeDrafts({});
  }, [tipo, search]);

  function changeTipo(next: Tipo) {
    if (next !== tipo) setTipo(next);
  }

  function toggleItem(id: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function togglePage() {
    const allSelected = rows.length > 0 && rows.every((row) => selected.has(row.idProducto));
    setSelected((current) => {
      const next = new Set(current);
      rows.forEach((row) => allSelected ? next.delete(row.idProducto) : next.add(row.idProducto));
      return next;
    });
  }

  async function assignProvider() {
    const ids = [...selected];
    if (!providerToAssign || !ids.length) return;
    if (!window.confirm(`Se asociará el proveedor seleccionado a ${ids.length} item${ids.length === 1 ? "" : "s"}. Los códigos de proveedor se cargarán después, cuando correspondan.\n\nContinuar?`)) return;
    try {
      setAssigning(true);
      const response = await fetch("/api/listados/proveedores-pendientes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ASIGNAR_PROVEEDOR", productIds: ids, idProveedor: Number(providerToAssign) }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "No se pudo asociar el proveedor.");
      toast.success(`${body.assigned || 0} item${body.assigned === 1 ? "" : "s"} actualizado${body.assigned === 1 ? "" : "s"}.`);
      setSelected(new Set());
      await mutate();
    } catch (requestError) {
      showError(requestError, "No se pudo asociar el proveedor");
    } finally {
      setAssigning(false);
    }
  }

  async function saveCode(row: Fila) {
    if (!row.idProveedor) return;
    const key = `${row.idProducto}:${row.idProveedor}`;
    const codigoProveedor = (codeDrafts[key] || "").trim();
    if (!codigoProveedor) {
      toast.error("Ingresa el código del proveedor.");
      return;
    }
    try {
      setSavingCode(row.idProducto);
      const response = await fetch("/api/listados/proveedores-pendientes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ASIGNAR_CODIGO", idProducto: row.idProducto, idProveedor: row.idProveedor, codigoProveedor }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "No se pudo guardar el código.");
      toast.success("Código de proveedor asignado.");
      setCodeDrafts((current) => { const next = { ...current }; delete next[key]; return next; });
      await mutate();
    } catch (requestError) {
      showError(requestError, "No se pudo guardar el código de proveedor");
    } finally {
      setSavingCode(null);
    }
  }

  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-slate-50 p-4 dark:bg-slate-950 md:p-6">
      <div className="mx-auto w-full max-w-[1500px]">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-300">Listados</p>
            <h1 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">Proveedores pendientes</h1>
            <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">Detectá items sin proveedor y relaciones a las que todavía les falta su código.</p>
          </div>
          <label className="relative w-full max-w-sm"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar código, descripción o proveedor" className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" /></label>
        </header>

        <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800">
          <button type="button" onClick={() => changeTipo("SIN_PROVEEDOR")} className={`border-b-2 px-4 py-3 text-sm font-black transition ${tipo === "SIN_PROVEEDOR" ? "border-blue-600 text-blue-700 dark:text-blue-300" : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"}`}>Sin proveedor</button>
          <button type="button" onClick={() => changeTipo("SIN_CODIGO")} className={`border-b-2 px-4 py-3 text-sm font-black transition ${tipo === "SIN_CODIGO" ? "border-blue-600 text-blue-700 dark:text-blue-300" : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"}`}>Proveedor sin código</button>
          <span className="ml-auto px-2 text-xs font-bold text-slate-500">{isLoading ? "Cargando..." : `${(data?.totalCount || 0).toLocaleString("es-AR")} pendientes`}</span>
        </div>

        {tipo === "SIN_PROVEEDOR" && canManage && (
          <section className="mb-4 flex flex-wrap items-end gap-3 border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900/70 dark:bg-blue-950/20">
            <label className="min-w-64 flex-1"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-blue-800 dark:text-blue-200">Proveedor para los items seleccionados</span><select value={providerToAssign} onChange={(event) => setProviderToAssign(event.target.value)} className="h-10 w-full rounded-lg border border-blue-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500 dark:border-blue-900 dark:bg-slate-950 dark:text-white"><option value="">Seleccionar proveedor</option>{proveedores.map((provider) => <option key={provider.id} value={provider.id}>{provider.descripcion}</option>)}</select></label>
            <button type="button" onClick={() => void assignProvider()} disabled={!providerToAssign || selected.size === 0 || assigning} className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-black uppercase tracking-wide text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"><UserPlus className="h-4 w-4" /> {assigning ? "Asignando" : `Asignar proveedor${selected.size ? ` (${selected.size})` : ""}`}</button>
          </section>
        )}

        {error && <p className="mb-4 border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error.message}</p>}
        <section className="overflow-hidden border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="min-w-[1040px] w-full text-left text-sm">
              <thead className="bg-slate-100 text-[10px] uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400"><tr>
                {tipo === "SIN_PROVEEDOR" && <th className="w-12 px-4 py-3"><input type="checkbox" aria-label="Seleccionar página" checked={rows.length > 0 && selectedOnPage === rows.length} onChange={togglePage} /></th>}
                <th className="px-4 py-3">Código</th><th className="px-4 py-3">Descripción</th><th className="px-4 py-3">Clasificación</th>
                {tipo === "SIN_CODIGO" && <><th className="px-4 py-3">Proveedor</th><th className="px-4 py-3">Precios</th><th className="px-4 py-3">Código proveedor</th></>}
                <th className="px-4 py-3 text-right">Acción</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((row) => {
                  const codeKey = `${row.idProducto}:${row.idProveedor}`;
                  return <tr key={`${row.idProducto}:${row.idProveedor || "sin"}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    {tipo === "SIN_PROVEEDOR" && <td className="px-4 py-3"><input type="checkbox" checked={selected.has(row.idProducto)} onChange={() => toggleItem(row.idProducto)} aria-label={`Seleccionar ${row.codigo}`} /></td>}
                    <td className="px-4 py-3 font-mono text-xs font-black text-blue-700 dark:text-blue-300">{row.codigo}</td>
                    <td className="max-w-[360px] px-4 py-3 font-bold text-slate-900 dark:text-white">{row.descripcion}</td>
                    <td className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400"><p>{row.marca || "Sin marca"}</p><p className="mt-1">{[row.categoria, row.subcategoria].filter(Boolean).join(" / ") || "Sin clasificación"}</p></td>
                    {tipo === "SIN_CODIGO" && <><td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-100">{row.proveedor}</td><td className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300"><p>Lista: {row.precioLista === null ? "-" : money.format(row.precioLista)}</p><p className="mt-1">Neto: {row.costoNeto === null ? "-" : money.format(row.costoNeto)}</p></td><td className="px-4 py-3"><div className="flex items-center gap-2"><input value={codeDrafts[codeKey] || ""} onChange={(event) => setCodeDrafts((current) => ({ ...current, [codeKey]: event.target.value.toUpperCase() }))} placeholder="Código" disabled={!canManage || savingCode === row.idProducto} className="h-9 min-w-40 rounded-md border border-slate-300 bg-white px-2 text-xs font-bold text-slate-900 outline-none focus:border-blue-500 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />{canManage && <button type="button" onClick={() => void saveCode(row)} disabled={!codeDrafts[codeKey]?.trim() || savingCode === row.idProducto} title="Guardar código proveedor" className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-emerald-500/40 text-emerald-700 transition hover:bg-emerald-500/10 disabled:opacity-40 dark:text-emerald-300"><Check className="h-4 w-4" /></button>}</div></td></>}
                    <td className="px-4 py-3 text-right"><Link href={`/productos/edit/${row.idProducto}`} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 px-3 text-xs font-black text-slate-700 transition hover:border-blue-400 hover:text-blue-700 dark:border-slate-700 dark:text-slate-200 dark:hover:text-blue-300"><Link2 className="h-4 w-4" /> Editar item</Link></td>
                  </tr>;
                })}
                {!isLoading && rows.length === 0 && <tr><td colSpan={tipo === "SIN_PROVEEDOR" ? 5 : 7} className="px-4 py-14 text-center text-sm font-semibold text-slate-500">No hay items pendientes con estos filtros.</td></tr>}
              </tbody>
            </table>
          </div>
          <footer className="flex items-center justify-between border-t border-slate-200 px-4 py-3 dark:border-slate-800"><span className="text-xs font-semibold text-slate-500">Página {data?.page || 1} de {data?.totalPages || 1}</span><div className="flex gap-1"><button type="button" aria-label="Página anterior" disabled={page <= 1 || isLoading} onClick={() => setPage((current) => current - 1)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 disabled:opacity-40 dark:border-slate-700"><ChevronLeft className="h-4 w-4" /></button><button type="button" aria-label="Página siguiente" disabled={page >= (data?.totalPages || 1) || isLoading} onClick={() => setPage((current) => current + 1)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 disabled:opacity-40 dark:border-slate-700"><ChevronRight className="h-4 w-4" /></button></div></footer>
        </section>
      </div>
    </main>
  );
}
