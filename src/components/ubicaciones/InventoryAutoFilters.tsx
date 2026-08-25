"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { RotateCcw, Search } from "lucide-react";
import type { CatalogoItem } from "@/interfaces/productos";
import { SERIE_ESTADO_LABELS, SERIE_ESTADOS_PERMITIDOS } from "@/lib/serie-estados";

type Props = {
  ubicaciones: CatalogoItem[];
  values: {
    search: string;
    idUbicacion: string;
    tipo: "SERIE" | "STOCK" | "";
    estado: string;
    canal: "ONLINE" | "MOSTRADOR" | "NO_VENDIBLE" | "";
  };
};

export function InventoryAutoFilters({ ubicaciones, values }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(values.search);

  const hasFilters = Boolean(values.search || values.idUbicacion || values.tipo || values.estado || values.canal);

  const baseParams = useMemo(() => {
    const params = new URLSearchParams();
    if (values.idUbicacion) params.set("id_ubicacion", values.idUbicacion);
    if (values.tipo) params.set("tipo", values.tipo);
    if (values.estado) params.set("estado", values.estado);
    if (values.canal) params.set("canal", values.canal);
    return params;
  }, [values.canal, values.estado, values.idUbicacion, values.tipo]);

  const navigate = (next: {
    search?: string;
    id_ubicacion?: string;
    tipo?: string;
    estado?: string;
    canal?: string;
  }) => {
    const params = new URLSearchParams();
    const nextSearch = next.search ?? search;
    const nextUbicacion = next.id_ubicacion ?? values.idUbicacion;
    const nextTipo = next.tipo ?? values.tipo;
    const nextEstado = next.estado ?? values.estado;
    const nextCanal = next.canal ?? values.canal;

    if (nextSearch.trim()) params.set("search", nextSearch.trim());
    if (nextUbicacion) params.set("id_ubicacion", nextUbicacion);
    if (nextTipo) params.set("tipo", nextTipo);
    if (nextEstado) params.set("estado", nextEstado);
    if (nextCanal) params.set("canal", nextCanal);

    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname);
    });
  };

  useEffect(() => {
    setSearch(values.search);
  }, [values.search]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const currentSearch = values.search.trim();
      const nextSearch = search.trim();
      if (currentSearch !== nextSearch) {
        const params = new URLSearchParams(baseParams);
        if (nextSearch) params.set("search", nextSearch);
        const query = params.toString();
        startTransition(() => {
          router.replace(query ? `${pathname}?${query}` : pathname);
        });
      }
    }, 350);

    return () => window.clearTimeout(handle);
  }, [baseParams, pathname, router, search, values.search]);

  return (
    <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.5fr_1fr_.85fr_.9fr_1fr_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="PRODUCTO, CODIGO, SERIE O UBICACION"
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs font-bold uppercase text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>

        <select
          value={values.idUbicacion}
          onChange={(event) => navigate({ id_ubicacion: event.target.value })}
          className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold uppercase text-slate-900 outline-none transition focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <option value="">Todas las ubicaciones</option>
          {ubicaciones.map((ubicacion) => (
            <option key={ubicacion.id} value={ubicacion.id}>{ubicacion.descripcion}</option>
          ))}
        </select>

        <select
          value={values.tipo}
          onChange={(event) => navigate({ tipo: event.target.value })}
          className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold uppercase text-slate-900 outline-none transition focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <option value="">Series y stock</option>
          <option value="SERIE">Solo series</option>
          <option value="STOCK">Solo stock</option>
        </select>

        <select
          value={values.estado}
          onChange={(event) => navigate({ estado: event.target.value })}
          className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold uppercase text-slate-900 outline-none transition focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <option value="">Todos los estados</option>
          {SERIE_ESTADOS_PERMITIDOS.map((item) => (
            <option key={item} value={item}>{SERIE_ESTADO_LABELS[item]}</option>
          ))}
        </select>

        <select
          value={values.canal}
          onChange={(event) => navigate({ canal: event.target.value })}
          className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold uppercase text-slate-900 outline-none transition focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <option value="">Todos los canales</option>
          <option value="ONLINE">Vendible online</option>
          <option value="MOSTRADOR">Vendible mostrador</option>
          <option value="NO_VENDIBLE">No vendible</option>
        </select>

        <button
          type="button"
          onClick={() => {
            setSearch("");
            startTransition(() => router.replace(pathname));
          }}
          disabled={!hasFilters}
          title="Limpiar filtros"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black uppercase tracking-widest text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900"
        >
          <RotateCcw className="h-4 w-4" />
          Limpiar
        </button>
      </div>
      {isPending && (
        <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-blue-500">
          Actualizando resultados...
        </p>
      )}
    </div>
  );
}
