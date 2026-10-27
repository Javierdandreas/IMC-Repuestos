"use client";

import { FormEvent, useState } from "react";
import { ChevronLeft, ChevronRight, LoaderCircle, Search } from "lucide-react";
import { toast } from "sonner";

type CompatibilityResponse = {
  itemId: string;
  products: Array<Record<string, unknown>>;
  paging: { total: number | null; limit: number; offset: number };
  universal: unknown;
};

function valueText(value: unknown) {
  if (value === null) return "Sin dato";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function label(key: string) {
  return key.replace(/_/g, " ");
}

export function MlaCompatibilityLookup() {
  const [itemId, setItemId] = useState("");
  const [data, setData] = useState<CompatibilityResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  const load = async (requestedPage: number) => {
    const normalized = itemId.trim().toUpperCase();
    if (!/^MLA\d+$/.test(normalized)) {
      toast.error("Ingresa un identificador MLA valido.");
      return;
    }
    try {
      setLoading(true);
      const params = new URLSearchParams({ itemId: normalized, page: String(requestedPage) });
      const response = await fetch(`/api/compatibilidades/publicacion?${params.toString()}`, { cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "No se pudieron consultar las compatibilidades.");
      setItemId(normalized);
      setData(result);
      setPage(requestedPage);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron consultar las compatibilidades.");
    } finally {
      setLoading(false);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void load(1);
  };

  const totalPages = data?.paging.total == null ? 1 : Math.max(1, Math.ceil(data.paging.total / data.paging.limit));

  return <section className="overflow-hidden border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
    <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800"><h2 className="text-sm font-black text-slate-900 dark:text-white">Compatibilidades de una publicacion</h2><p className="mt-1 text-sm text-slate-500">Consulta los vehiculos y datos informados por Mercado Libre para un MLA.</p></div>
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3 border-b border-slate-200 p-5 dark:border-slate-800">
      <label className="block min-w-0 flex-1"><span className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Publicacion MLA</span><input value={itemId} onChange={(event) => setItemId(event.target.value.toUpperCase())} placeholder="MLA123456789" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 font-mono text-sm font-bold uppercase text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
      <button type="submit" disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-xs font-black text-white hover:bg-blue-500 disabled:opacity-50">{loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}{loading ? "Consultando..." : "Consultar"}</button>
    </form>

    {data && <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3 text-xs font-bold text-slate-600 dark:border-slate-800 dark:text-slate-300"><span>{data.itemId}</span><span>{data.paging.total == null ? `${data.products.length} respuestas recibidas` : `${data.paging.total.toLocaleString("es-AR")} compatibilidades`}</span></div>
      {data.universal != null && <div className="border-b border-slate-200 px-5 py-3 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:text-slate-300">Universal: {valueText(data.universal)}</div>}
      <div className="divide-y divide-slate-200 dark:divide-slate-800">
        {data.products.length === 0 && <p className="px-5 py-8 text-center text-sm font-semibold text-slate-500">Mercado Libre no informo compatibilidades para esta publicacion.</p>}
        {data.products.map((product, index) => {
          const attributes = Array.isArray(product.attributes) ? product.attributes : [];
          const fields = Object.entries(product).filter(([key]) => key !== "attributes");
          return <article key={`${product.id ?? product.catalog_product_id ?? product.catalog_product_name ?? "compatibilidad"}-${index}`} className="px-5 py-4">
            <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">{fields.map(([key, value]) => <div key={key} className="min-w-0"><p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label(key)}</p><p className="mt-1 break-words text-xs font-bold text-slate-800 dark:text-slate-100">{valueText(value)}</p></div>)}</div>
            {attributes.length > 0 && <div className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-800"><p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Atributos del vehiculo</p><div className="mt-2 grid gap-x-5 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">{attributes.map((attribute, attributeIndex) => { const item: Record<string, unknown> = attribute && typeof attribute === "object" && !Array.isArray(attribute) ? attribute as Record<string, unknown> : { value: attribute }; return <div key={`${String(item.id ?? "atributo")}-${attributeIndex}`} className="min-w-0"><p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{valueText(item.name ?? item.id ?? "Atributo")}</p><p className="mt-1 break-words text-xs font-bold text-slate-800 dark:text-slate-100">{valueText(item.value_name ?? item.value_id ?? item.value)}</p></div>; })}</div></div>}
            <details className="mt-4"><summary className="cursor-pointer text-xs font-bold text-blue-600 dark:text-blue-300">Ver respuesta completa</summary><pre className="mt-2 max-h-72 overflow-auto border border-slate-200 bg-slate-50 p-3 text-[11px] leading-5 text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">{JSON.stringify(product, null, 2)}</pre></details>
          </article>;
        })}
      </div>
      {totalPages > 1 && <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 dark:border-slate-800"><span className="text-xs font-semibold text-slate-500">Pagina {page} de {totalPages}</span><div className="flex gap-2"><button type="button" onClick={() => void load(page - 1)} disabled={loading || page <= 1} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-500 disabled:opacity-40 dark:border-slate-700" title="Pagina anterior"><ChevronLeft className="h-4 w-4" /></button><button type="button" onClick={() => void load(page + 1)} disabled={loading || page >= totalPages} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-500 disabled:opacity-40 dark:border-slate-700" title="Pagina siguiente"><ChevronRight className="h-4 w-4" /></button></div></div>}
    </>}
  </section>;
}
