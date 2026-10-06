"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { HiCheck, HiCloudUpload, HiCollection, HiCube, HiExclamation, HiPlay, HiRefresh } from "react-icons/hi";
import { Modal } from "@/components/ui/Modal";
import { TransferProgressModal } from "@/components/ui/TransferProgressModal";
import type { GesuImportResult } from "@/lib/gesu-importacion";
import { cantidadComponenteKitValida } from "@/lib/kit-cantidades";

type ProductImportRow = Record<string, string | number | null>;

type SourceRow = {
  code: string;
  title: string;
  rowNumber: number;
};

type ProductSourceRow = SourceRow & {
  importRow: ProductImportRow;
};

type KitSourceRow = SourceRow & {
  components: Array<{ code: string; quantity: number }>;
  unresolvedComponents: string[];
  hasComponentFormat: boolean;
};

type ParsedGesuFile = {
  headerRow: number;
  products: ProductSourceRow[];
  kits: KitSourceRow[];
  ignored: Record<string, number>;
  duplicates: string[];
};

type PreviewData = ParsedGesuFile & {
  existingProductCodes: Set<string>;
  existingKitCodes: Set<string>;
};

type ApplyResults = GesuImportResult;
const RECOVERY_KEY = "imc:gesu:pending";

async function sendGesu(body: Record<string, unknown>) {
  const response = await fetch("/api/productos/import/gesu/sesion", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "No se pudo confirmar la importacion. Reintenta con la misma sesion.");
  return data;
}

const normalize = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

const isEmptyRow = (row: unknown[]) => row.every((value) => String(value ?? "").trim() === "");

const findHeaderRow = (rows: unknown[][]) =>
  rows.findIndex((row) => {
    const headers = new Set(row.map(normalize));
    return headers.has("TIPO") && headers.has("CODIGO") && headers.has("TITULO");
  });

const parseKitComponents = (title: string, productCodes: Set<string>) => {
  const matches = Array.from(title.toUpperCase().matchAll(/([A-Z0-9+._/-]+?)\s*X\s*(\d+)(?=\s|$)/g));
  const componentTotals = new Map<string, number>();
  const unresolved = new Set<string>();
  let invalidQuantity = false;

  matches.forEach((match) => {
    const code = normalize(match[1]);
    const quantity = cantidadComponenteKitValida(match[2]);
    if (!code || !quantity) { invalidQuantity = true; return; }

    if (!productCodes.has(code)) {
      unresolved.add(code);
    }

    const total = (componentTotals.get(code) ?? 0) + quantity;
    if (!cantidadComponenteKitValida(total)) invalidQuantity = true;
    componentTotals.set(code, total);
  });

  return {
    hasComponentFormat: matches.length > 0 && !invalidQuantity,
    components: Array.from(componentTotals, ([code, quantity]) => ({ code, quantity })),
    unresolvedComponents: Array.from(unresolved),
  };
};

function parseGesuRows(rows: unknown[][]): ParsedGesuFile {
  const headerIndex = findHeaderRow(rows);
  if (headerIndex < 0) {
    throw new Error('No se encontro la fila con las columnas "Tipo", "Codigo" y "Titulo".');
  }

  const headerMap = new Map(rows[headerIndex].map((header, index) => [normalize(header), index]));
  const typeColumn = headerMap.get("TIPO");
  const codeColumn = headerMap.get("CODIGO");
  const titleColumn = headerMap.get("TITULO");
  if (typeColumn === undefined || codeColumn === undefined || titleColumn === undefined) {
    throw new Error("No se pudieron identificar las columnas principales de GESU.");
  }

  const products: ProductSourceRow[] = [];
  const rawKits: SourceRow[] = [];
  const ignored: Record<string, number> = {};
  const allCodes = new Set<string>();
  const duplicates = new Set<string>();

  rows.slice(headerIndex + 1).forEach((row, index) => {
    if (isEmptyRow(row)) return;

    const type = normalize(row[typeColumn]);
    const code = normalize(row[codeColumn]);
    const title = String(row[titleColumn] ?? "").trim();
    const rowNumber = headerIndex + index + 2;

    if (type !== "PRODUCTO" && type !== "GRUPO") {
      if (type) ignored[type] = (ignored[type] ?? 0) + 1;
      return;
    }

    if (!code) {
      duplicates.add(`Fila ${rowNumber} sin codigo`);
      return;
    }

    if (allCodes.has(code)) {
      duplicates.add(code);
      return;
    }

    allCodes.add(code);
    const getValue = (header: string) => {
      const column = headerMap.get(normalize(header));
      return column === undefined ? null : (row[column] as string | number | null);
    };

    const sourceRow = { code, title: title || code, rowNumber };
    if (type === "PRODUCTO") {
      products.push({
        ...sourceRow,
        importRow: {
          "Codigo Unico": code,
          "Descripcion": title || code,
          "Codigo de Barras": getValue("Codigo de Barras"),
          "Stock": getValue("Stock Actual"),
          "Marca": getValue("Marca"),
          "Subcategoria": getValue("Subcategoria"),
          "Ubicacion": getValue("Ubicacion Interna"),
          "Proveedor": getValue("Proveedor"),
          "Codigo Proveedor": getValue("Codigo en Proveedor"),
          "Precio Lista Proveedor": getValue("Precio Compra Con IVA"),
        },
      });
    }
    else rawKits.push(sourceRow);
  });

  const productCodes = new Set(products.map((item) => item.code));
  const kits = rawKits.map((kit) => ({ ...kit, ...parseKitComponents(kit.title, productCodes) }));

  return {
    headerRow: headerIndex + 1,
    products,
    kits,
    ignored,
    duplicates: Array.from(duplicates),
  };
}

const chunk = <T,>(items: T[], size: number) => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
};

async function findExistingCodes(type: "productos" | "kits", codes: string[]) {
  const batches = chunk(codes, 900);
  const existingCodes = new Set<string>();
  let nextBatch = 0;

  const worker = async () => {
    while (nextBatch < batches.length) {
      const batch = batches[nextBatch++];
      const response = await fetch("/api/productos/import/gesu/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, codes: batch }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No se pudo comparar el catalogo actual.");
      data.existingCodes.forEach((code: string) => existingCodes.add(normalize(code)));
    }
  };

  await Promise.all(Array.from({ length: Math.min(3, batches.length) }, worker));
  return existingCodes;
}

function groupRows<T>(groups: T[][], maxRows: number) {
  const batches: T[][] = [];
  let current: T[] = [];

  groups.forEach((group) => {
    if (current.length > 0 && current.length + group.length > maxRows) {
      batches.push(current);
      current = [];
    }
    current.push(...group);
  });

  if (current.length > 0) batches.push(current);
  return batches;
}

function PreviewMetric({ label, value, tone = "slate" }: { label: string; value: number; tone?: "slate" | "blue" | "green" | "amber" | "red" }) {
  const tones = {
    slate: "border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-800 dark:bg-slate-900/50 dark:text-white",
    blue: "border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-300",
    green: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    amber: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    red: "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300",
  };

  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <p className="text-[10px] font-black uppercase tracking-widest opacity-70">{label}</p>
      <p className="mt-2 text-3xl font-black">{value.toLocaleString("es-AR")}</p>
    </div>
  );
}

export function GesuImportPreview() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmingApply, setConfirmingApply] = useState(false);
  const [applying, setApplying] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [estimatedRemainingMs, setEstimatedRemainingMs] = useState<number | null>(null);
  const [applyResults, setApplyResults] = useState<ApplyResults | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [recoveryId, setRecoveryId] = useState<string | null>(null);
  const [phase, setPhase] = useState<"preparing" | "applying">("preparing");
  const [totalBatches, setTotalBatches] = useState(0);

  useEffect(() => { setRecoveryId(sessionStorage.getItem(RECOVERY_KEY)); }, []);
  useEffect(() => {
    if (!applying) return;
    const started = Date.now();
    const timer = setInterval(() => setElapsedMs(Date.now() - started), 1000);
    return () => clearInterval(timer);
  }, [applying]);

  const calculations = useMemo(() => {
    if (!preview) return null;

    const existingProducts = preview.products.filter((item) => preview.existingProductCodes.has(item.code));
    const newProducts = preview.products.filter((item) => !preview.existingProductCodes.has(item.code));
    const existingKits = preview.kits.filter((kit) => preview.existingKitCodes.has(kit.code));
    const newKits = preview.kits.filter((kit) => !preview.existingKitCodes.has(kit.code));
    const productsToConvert = preview.kits.filter((kit) => preview.existingProductCodes.has(kit.code));
    const kitsNeedingReview = preview.kits.filter((kit) => !kit.hasComponentFormat || kit.unresolvedComponents.length > 0);

    return { existingProducts, newProducts, existingKits, newKits, productsToConvert, kitsNeedingReview };
  }, [preview]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setSessionId(null);
    setApplyResults(null);
    setPreview(null);
    setLoading(true);

    try {
      const fileData = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(fileData, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true });
      const parsed = parseGesuRows(rows);
      const productAndKitCodes = Array.from(new Set([
        ...[...parsed.products, ...parsed.kits].map((item) => item.code),
        ...parsed.kits.flatMap((kit) => kit.unresolvedComponents),
      ]));

      const [existingProductCodes, existingKitCodes] = await Promise.all([
        findExistingCodes("productos", productAndKitCodes),
        findExistingCodes("kits", parsed.kits.map((item) => item.code)),
      ]);

      setPreview({ ...parsed, kits: parsed.kits.map((kit) => ({ ...kit,
        unresolvedComponents: kit.unresolvedComponents.filter((code) => !existingProductCodes.has(code)),
      })), existingProductCodes, existingKitCodes });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo leer el archivo de GESU.");
      setFile(null);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setApplyResults(null);
    setConfirmingApply(false);
    setSessionId(null);
  };

  const applyImport = async () => {
    if (!preview || !calculations) return;
    if (preview.duplicates.length || calculations.kitsNeedingReview.length) {
      toast.error("Corrige los duplicados y kits pendientes antes de aplicar.");
      return;
    }

    setConfirmingApply(false);
    setApplying(true);
    setProcessedCount(0);
    setElapsedMs(0);
    setEstimatedRemainingMs(null);
    setApplyResults(null);

    const validKits = preview.kits.filter((kit) => !calculations.kitsNeedingReview.some((pendingKit) => pendingKit.code === kit.code));
    const productBatches = groupRows(preview.products.map((product) => [product.importRow]), 250);
    const kitBatches = groupRows(
      validKits.map((kit) => kit.components.map((component) => ({
        "Codigo Kit": kit.code,
        "Nombre Kit": kit.title,
        "Codigo Item": component.code,
        "Cantidad": component.quantity,
      }))),
      500
    );
    const batches: Array<{ type: "productos" | "kits"; rows: ProductImportRow[] }> = [
      ...productBatches.map((rows) => ({ type: "productos" as const, rows })),
      ...kitBatches.map((rows) => ({ type: "kits" as const, rows })),
    ];
    if (!batches.length) { setApplying(false); return; }
    const id = sessionId || crypto.randomUUID();
    setSessionId(id);
    setPhase("preparing");
    setTotalBatches(batches.length);
    const startTime = Date.now();

    try {
      await sendGesu({ action: "iniciar", id, fileName: file?.name || "gesu.xls", totalBatches: batches.length });
      sessionStorage.setItem(RECOVERY_KEY, id);
      setRecoveryId(id);
      for (let index = 0; index < batches.length; index += 1) {
        await sendGesu({ action: "lote", id, batch: index, type: batches[index].type, rows: batches[index].rows });
        setProcessedCount(index + 1);
      }
      setPhase("applying");
      setProcessedCount(0);
      const data = await sendGesu({ action: "aplicar", id });
      setApplyResults(data.result as ApplyResults);
      sessionStorage.removeItem(RECOVERY_KEY);
      setRecoveryId(null);
      toast.success("Importacion de GESU terminada.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo completar la importacion.";
      toast.error(message);
    } finally {
      setApplying(false);
      setElapsedMs(Date.now() - startTime);
    }
  };

  const recoverImport = async () => {
    if (!recoveryId) return;
    setApplying(true);
    setPhase("applying");
    setElapsedMs(0);
    try {
      const data = await sendGesu({ action: "aplicar", id: recoveryId });
      setApplyResults(data.result as ApplyResults);
      sessionStorage.removeItem(RECOVERY_KEY);
      setRecoveryId(null);
      toast.success("Importacion confirmada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo confirmar la importacion.");
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-950">
        <HiRefresh className="h-8 w-8 animate-spin text-blue-500" />
        <p className="mt-4 text-sm font-black text-slate-900 dark:text-white">Analizando archivo de GESU</p>
        <p className="mt-1 text-xs font-medium text-slate-500">Comparando productos y kits con el catalogo actual.</p>
      </div>
    );
  }

  if (!preview || !calculations) {
    return (
      <div className="space-y-4">
        {recoveryId && <section className="flex flex-col gap-3 border border-amber-500/30 bg-amber-500/10 p-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm font-bold text-amber-900 dark:text-amber-100">Hay una importacion iniciada que necesita confirmacion.</p><button type="button" onClick={recoverImport} disabled={applying} className="h-10 rounded-lg bg-blue-600 px-4 text-xs font-black text-white disabled:opacity-50">Consultar / reintentar</button></section>}
        <label className="group flex min-h-80 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center transition hover:border-blue-400 hover:bg-blue-50/50 dark:border-slate-700 dark:bg-slate-900/30 dark:hover:border-blue-500/60 dark:hover:bg-blue-500/5">
          <input type="file" className="hidden" accept=".xls,.xlsx" onChange={handleFileChange} />
          <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-white text-blue-500 shadow-sm ring-1 ring-slate-200 transition group-hover:scale-105 dark:bg-slate-900 dark:ring-slate-800"><HiCloudUpload className="h-8 w-8" /></span>
          <span className="mt-5 text-base font-black text-slate-900 dark:text-white">Seleccionar exportacion de GESU</span>
          <span className="mt-1 text-xs font-medium text-slate-500">Archivo Excel con las columnas Tipo, Codigo y Titulo.</span>
        </label>
      </div>
    );
  }

  const ignoredEntries = Object.entries(preview.ignored).sort(([left], [right]) => left.localeCompare(right));
  const validKits = preview.kits.filter((kit) => !calculations.kitsNeedingReview.some((pendingKit) => pendingKit.code === kit.code));
  const sampleChanges = [
    ...calculations.existingProducts.slice(0, 4).map((item) => ({ ...item, action: "Actualizar", tone: "text-blue-500" })),
    ...calculations.newProducts.slice(0, 4).map((item) => ({ ...item, action: "Crear", tone: "text-emerald-500" })),
    ...calculations.productsToConvert.slice(0, 4).map((item) => ({ ...item, action: "Convertir en kit", tone: "text-amber-500" })),
  ];

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Archivo analizado</p>
          <p className="mt-1 truncate text-sm font-black text-slate-900 dark:text-white">{file?.name}</p>
          <p className="mt-1 text-xs font-medium text-slate-500">Encabezados detectados en la fila {preview.headerRow}. Esta vista no modifica el catalogo.</p>
        </div>
        <button type="button" onClick={reset} className="h-10 shrink-0 rounded-lg border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800">
          Cambiar archivo
        </button>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <HiCube className="h-5 w-5 text-blue-500" />
          <h2 className="text-sm font-black uppercase tracking-wide text-slate-900 dark:text-white">Items</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <PreviewMetric label="Productos en archivo" value={preview.products.length} />
          <PreviewMetric label="Ya existen" value={calculations.existingProducts.length} tone="blue" />
          <PreviewMetric label="Se crearian" value={calculations.newProducts.length} tone="green" />
          <PreviewMetric label="Duplicados o sin codigo" value={preview.duplicates.length} tone={preview.duplicates.length ? "red" : "slate"} />
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <HiCollection className="h-5 w-5 text-violet-500" />
          <h2 className="text-sm font-black uppercase tracking-wide text-slate-900 dark:text-white">Kits detectados</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <PreviewMetric label="Grupos en archivo" value={preview.kits.length} />
          <PreviewMetric label="Ya son kits" value={calculations.existingKits.length} tone="blue" />
          <PreviewMetric label="Kits a crear" value={calculations.newKits.length} tone="green" />
          <PreviewMetric label="Productos a convertir" value={calculations.productsToConvert.length} tone="amber" />
          <PreviewMetric label="Requieren revision" value={calculations.kitsNeedingReview.length} tone={calculations.kitsNeedingReview.length ? "red" : "green"} />
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-col gap-1 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/50">
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">Muestra de cambios</h2>
          <p className="text-[11px] font-medium text-slate-500">Los productos existentes se actualizaran. Los productos a convertir pasaran a ser kits al aplicar el siguiente paso.</p>
        </div>
        <div className="grid grid-cols-[110px_minmax(130px,0.8fr)_minmax(220px,1.8fr)] border-b border-slate-200 bg-slate-100 px-4 py-2 text-[9px] font-black uppercase tracking-widest text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          <span>Accion</span>
          <span>Codigo</span>
          <span>Descripcion</span>
        </div>
        {sampleChanges.map((item) => (
          <div key={`${item.action}-${item.code}`} className="grid grid-cols-[110px_minmax(130px,0.8fr)_minmax(220px,1.8fr)] border-b border-slate-200 px-4 py-2.5 text-xs last:border-b-0 dark:border-slate-800">
            <span className={`font-black ${item.tone}`}>{item.action}</span>
            <span className="truncate font-mono font-bold text-slate-700 dark:text-slate-200" title={item.code}>{item.code}</span>
            <span className="truncate font-bold text-slate-600 dark:text-slate-300" title={item.title}>{item.title}</span>
          </div>
        ))}
      </section>

      {(calculations.kitsNeedingReview.length > 0 || preview.duplicates.length > 0 || ignoredEntries.length > 0) && (
        <section className="space-y-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
            <HiExclamation className="h-5 w-5" />
            <h2 className="text-xs font-black uppercase tracking-widest">Revision necesaria</h2>
          </div>

          {calculations.kitsNeedingReview.length > 0 && (
            <div className="text-xs text-amber-800 dark:text-amber-200">
              <p className="font-bold">Kits sin todos sus componentes detectados:</p>
              <p className="mt-1 font-mono text-[11px] opacity-80">
                {calculations.kitsNeedingReview.slice(0, 8).map((kit) => kit.code).join(", ")}
                {calculations.kitsNeedingReview.length > 8 ? ` y ${calculations.kitsNeedingReview.length - 8} mas.` : "."}
              </p>
            </div>
          )}

          {preview.duplicates.length > 0 && (
            <div className="text-xs text-amber-800 dark:text-amber-200">
              <p className="font-bold">Codigos repetidos o vacios: {preview.duplicates.slice(0, 8).join(", ")}</p>
            </div>
          )}

          {ignoredEntries.length > 0 && (
            <div className="flex flex-wrap gap-2 text-[11px] font-bold text-amber-800 dark:text-amber-200">
              {ignoredEntries.map(([type, count]) => (
                <span key={type} className="rounded-md border border-amber-500/20 bg-white/50 px-2 py-1 dark:bg-slate-950/30">{type}: {count.toLocaleString("es-AR")} ignorados</span>
              ))}
            </div>
          )}
        </section>
      )}

      {applyResults ? (
        <section className="space-y-4 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
            <HiCheck className="h-5 w-5 text-emerald-500" />
            <h2 className="text-xs font-black uppercase tracking-widest">Resultado de la importacion</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <PreviewMetric label="Items creados" value={applyResults.productsImported} tone="green" />
            <PreviewMetric label="Items actualizados" value={applyResults.productsUpdated} tone="blue" />
            <PreviewMetric label="Kits creados" value={applyResults.kitsImported} tone="green" />
            <PreviewMetric label="Kits actualizados" value={applyResults.kitsUpdated} tone="blue" />
            <PreviewMetric label="Originales eliminados" value={applyResults.deletedProducts} tone="amber" />
          </div>
          {applyResults.errors.length > 0 && (
            <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-200">
              <p className="font-black uppercase tracking-widest">Datos para revisar</p>
              <p className="mt-2 font-mono text-[11px] leading-5">{applyResults.errors.join(" | ")}</p>
            </div>
          )}
          {applyResults.missingProviders.length > 0 && (
            <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-200">
              <p className="font-black uppercase tracking-widest">Proveedores no encontrados</p>
              <p className="mt-2 font-mono text-[11px] leading-5">{applyResults.missingProviders.join(", ")}</p>
            </div>
          )}
        </section>
      ) : (
        <section className="flex flex-col gap-3 rounded-xl border border-blue-500/25 bg-blue-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-bold text-blue-800 dark:text-blue-200">La carga se valida por completo y luego se aplica en una sola operacion. Los originales convertidos se eliminan solo si no tienen conflictos.</p>
          <button type="button" onClick={() => setConfirmingApply(true)} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-xs font-black uppercase tracking-widest text-white transition hover:bg-blue-700">
            <HiPlay className="h-5 w-5" />
            Aplicar importacion
          </button>
        </section>
      )}

      <section className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-emerald-800 dark:text-emerald-200">
        <HiCheck className="h-5 w-5 shrink-0 text-emerald-500" />
        <p className="text-xs font-bold">Servicios e insumos no se incluyen. {applyResults ? "La importacion finalizo sin aplicarlos." : "Todavia no se aplico ningun cambio."}</p>
      </section>

      <Modal title="Aplicar importacion de GESU" open={confirmingApply} onClose={() => setConfirmingApply(false)} width="max-w-lg">
        <div className="space-y-5 p-5">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Se procesaran {preview.products.length.toLocaleString("es-AR")} items y {validKits.length.toLocaleString("es-AR")} kits completos. Si un original convertido tiene stock, ventas, compras, series o vinculos pendientes, se cancelara toda la importacion sin guardar cambios.
          </p>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setConfirmingApply(false)} className="h-10 rounded-lg border border-slate-200 px-4 text-xs font-black text-slate-600 dark:border-slate-700 dark:text-slate-300">Cancelar</button>
            <button type="button" onClick={applyImport} className="h-10 rounded-lg bg-blue-600 px-4 text-xs font-black uppercase tracking-widest text-white transition hover:bg-blue-700">Aplicar</button>
          </div>
        </div>
      </Modal>

      <TransferProgressModal
        open={applying}
        title={phase === "preparing" ? "Preparando importacion de GESU" : "Aplicando importacion de GESU"}
        description={phase === "preparing" ? "Enviando lotes validados. Todavia no se modifica el catalogo." : "Guardando items, kits y conversiones en una sola operacion."}
        total={phase === "preparing" ? totalBatches : undefined}
        processed={phase === "preparing" ? processedCount : undefined}
        unit="lotes"
        elapsedMs={elapsedMs}
        estimatedRemainingMs={estimatedRemainingMs}
      />
    </div>
  );
}
