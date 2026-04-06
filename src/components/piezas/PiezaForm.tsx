"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CategoriaOption, Pieza, SubcategoriaOption } from "@/interfaces/piezas";

type Props = {
  onSuccess?: () => void;
  onCancel?: () => void;
  piezaId?: number;
  initialPieza?: Pieza;
  categorias: CategoriaOption[];
  subcategorias: SubcategoriaOption[];
};

const initialState: Pieza = {
  codigo_pieza: undefined,
  descripcion: "",
  medida: "",
  id_categoria: null,
  id_subcategoria: null,
  originales: [],
  equivalentes: [],
};

function splitCodes(value: string): string[] {
  return Array.from(
    new Set(
      value
        .toUpperCase()
        .split(/\s+/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function codesToText(codes: string[]): string {
  return codes.join(" ");
}

export function PiezaForm({ onSuccess, onCancel, piezaId, initialPieza, categorias, subcategorias }: Props) {
  const router = useRouter();
  const descripcionRef = useRef<HTMLTextAreaElement | null>(null);
  const isEditMode = Boolean(piezaId);
  const [pieza, setPieza] = useState<Pieza>({
    ...initialState,
    ...initialPieza,
    codigo_pieza: initialPieza?.codigo_pieza,
    descripcion: initialPieza?.descripcion?.toUpperCase() ?? "",
    medida: initialPieza?.medida?.toUpperCase() ?? "",
    id_categoria:
      initialPieza?.id_categoria ??
      subcategorias.find((item) => Number(item.id) === Number(initialPieza?.id_subcategoria))?.id_categoria ??
      null,
    originales: initialPieza?.originales ?? [],
    equivalentes: initialPieza?.equivalentes ?? [],
  });
  const [originalesTexto, setOriginalesTexto] = useState(codesToText(initialPieza?.originales ?? []));
  const [equivalentesTexto, setEquivalentesTexto] = useState(codesToText(initialPieza?.equivalentes ?? []));
  const [nextCodigoPieza, setNextCodigoPieza] = useState(String(initialPieza?.codigo_pieza ?? ""));
  const [loadingCodigo, setLoadingCodigo] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const textarea = descripcionRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 72), 150)}px`;
  }, [pieza.descripcion]);

  useEffect(() => {
    if (isEditMode) {
      setNextCodigoPieza(String(initialPieza?.codigo_pieza ?? ""));
      return;
    }

    let active = true;
    setLoadingCodigo(true);

    fetch("/api/piezas/next-codigo", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.message || "No se pudo obtener el próximo número de pieza");
        }
        if (active) {
          setNextCodigoPieza(String(data.codigo_pieza ?? 1000));
        }
      })
      .catch((error: any) => {
        if (active) {
          setNextCodigoPieza("");
          toast.error(error.message || "No se pudo obtener el próximo número de pieza");
        }
      })
      .finally(() => {
        if (active) setLoadingCodigo(false);
      });

    return () => {
      active = false;
    };
  }, [isEditMode, initialPieza?.codigo_pieza]);

  const subcategoriasFiltradas = useMemo(() => {
    if (!pieza.id_categoria) return [];
    return subcategorias.filter((item) => Number(item.id_categoria) === Number(pieza.id_categoria));
  }, [subcategorias, pieza.id_categoria]);

  const handleCategoriaChange = (value: string) => {
    const idCategoria = value === "" ? null : Number(value);
    setPieza((prev) => ({
      ...prev,
      id_categoria: idCategoria,
      id_subcategoria:
        idCategoria && subcategorias.some((item) => item.id === prev.id_subcategoria && item.id_categoria === idCategoria)
          ? prev.id_subcategoria
          : null,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const originales = splitCodes(originalesTexto);
      const equivalentes = splitCodes(equivalentesTexto);

      const payload = {
        descripcion: pieza.descripcion.trim().toUpperCase(),
        medida: pieza.medida.trim().toUpperCase(),
        id_subcategoria: pieza.id_subcategoria,
        originales,
        equivalentes
      };

      const url = piezaId ? `/api/piezas/${piezaId}` : "/api/piezas";
      const method = piezaId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "No se pudo guardar la pieza");

      const codigoGenerado = String(data.codigo_pieza ?? nextCodigoPieza ?? "");
      toast.success(
        piezaId
          ? `Pieza ${codigoGenerado || ""} actualizada correctamente`.trim()
          : `Pieza creada correctamente · N° ${codigoGenerado || "-"}`
      );
      if (data.warning) {
        toast.warning(data.warning);
      }

      if (onSuccess) {
        onSuccess();
        router.refresh();
      } else {
        router.push("/piezas");
        router.refresh();
      }
    } catch (error: any) {
      toast.error(error.message || "No se pudo guardar la pieza");
    } finally {
      setLoading(false);
    }
  };

  const originalesPreview = splitCodes(originalesTexto);
  const equivalentesPreview = splitCodes(equivalentesTexto);

  const previewChip = (codigo: string) => (
    <span
      key={codigo}
      className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-semibold uppercase tracking-[0.02em] text-slate-700"
    >
      {codigo}
    </span>
  );

  const codigoMostrado = isEditMode ? String(pieza.codigo_pieza ?? "") : nextCodigoPieza;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-[220px_1fr_1fr]">
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Código de pieza</label>
          <div className="flex h-11 w-full items-center rounded-xl border border-slate-300 bg-slate-50 px-4 text-sm font-semibold uppercase tracking-[0.02em] text-slate-700 shadow-sm">
            {loadingCodigo ? "Cargando..." : codigoMostrado || "Se asignará al guardar"}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Categoría</label>
          <select
            value={pieza.id_categoria ?? ""}
            onChange={(e) => handleCategoriaChange(e.target.value)}
            className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            required
          >
            <option value="">Seleccionar categoría</option>
            {categorias.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>{categoria.descripcion}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Subcategoría</label>
          <select
            value={pieza.id_subcategoria ?? ""}
            onChange={(e) => setPieza((prev) => ({ ...prev, id_subcategoria: e.target.value === "" ? null : Number(e.target.value) }))}
            className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            required
            disabled={!pieza.id_categoria}
          >
            <option value="">Seleccionar subcategoría</option>
            {subcategoriasFiltradas.map((sub) => (
              <option key={sub.id} value={sub.id}>{sub.descripcion}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-700">Descripción</label>
        <textarea
          ref={descripcionRef}
          value={pieza.descripcion}
          onChange={(e) => setPieza((prev) => ({ ...prev, descripcion: e.target.value.toUpperCase() }))}
          className="w-full resize-none overflow-hidden rounded-xl border border-slate-300 px-4 py-2.5 uppercase shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          style={{ minHeight: 72 }}
          placeholder="Ingresar descripción"
          required
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-700">Medida</label>
        <input
          type="text"
          value={pieza.medida}
          onChange={(e) => setPieza((prev) => ({ ...prev, medida: e.target.value.toUpperCase() }))}
          className="h-11 w-full rounded-xl border border-slate-300 px-4 uppercase shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          placeholder="Ej. 45MM x 30MM"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
          <div className="mb-3">
            <h3 className="text-base font-semibold text-slate-800">Números originales</h3>
            <p className="mt-1 text-sm text-slate-600">Pegá varios códigos separados por espacios.</p>
          </div>
          <textarea
            value={originalesTexto}
            onChange={(e) => setOriginalesTexto(e.target.value.toUpperCase())}
            className="min-h-[110px] w-full rounded-xl border border-slate-300 bg-white px-4 py-3 uppercase shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            placeholder="EJ: 1K0505465AA 1K0505465K 1K0505465L"
          />
          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-2 text-sm font-semibold text-slate-700">Vista previa</div>
            <div className="flex min-h-[44px] flex-wrap items-center gap-2">
              {originalesPreview.length === 0 ? <span className="text-sm text-slate-500">Todavía no cargaste originales.</span> : originalesPreview.map(previewChip)}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
          <div className="mb-3">
            <h3 className="text-base font-semibold text-slate-800">Números equivalentes</h3>
            <p className="mt-1 text-sm text-slate-600">Pegá varios códigos separados por espacios.</p>
          </div>
          <textarea
            value={equivalentesTexto}
            onChange={(e) => setEquivalentesTexto(e.target.value.toUpperCase())}
            className="min-h-[110px] w-full rounded-xl border border-slate-300 bg-white px-4 py-3 uppercase shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            placeholder="EJ: 1K0505465C 1K0505465J 1K0505465R"
          />
          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-2 text-sm font-semibold text-slate-700">Vista previa</div>
            <div className="flex min-h-[44px] flex-wrap items-center gap-2">
              {equivalentesPreview.length === 0 ? <span className="text-sm text-slate-500">Todavía no cargaste equivalencias.</span> : equivalentesPreview.map(previewChip)}
            </div>
          </div>
        </section>
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-lg border border-gray-300 px-5 py-2.5 text-gray-700 transition hover:bg-gray-50">Cancelar</button>
        )}
        <button
          type="submit"
          disabled={loading || loadingCodigo}
          className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </form>
  );
}
