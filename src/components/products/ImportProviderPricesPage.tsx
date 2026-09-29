"use client";

import { ChangeEvent, useMemo, useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { HiArrowLeft, HiCheck, HiCloudUpload, HiPlay, HiRefresh } from "react-icons/hi";
import { useRouter } from "next/navigation";
import { TransferProgressModal } from "@/components/ui/TransferProgressModal";

type Step = "upload" | "mapping" | "importing" | "results";
type Mapping = { csvHeader: string };
type ImportError = { row: number; error: string; codigo_item: string; proveedor: string };
type ImportResult = {
  updated: number;
  pricesUpdated: number;
  stockUpdated: number;
  recalculated: number;
  ignored: number;
  errors: ImportError[];
};

type ImportField = {
  id: string;
  label: string;
  required?: boolean;
  aliases: string[];
};

const FIELDS: ImportField[] = [
  { id: "codigo_item", label: "Codigo Item", required: true, aliases: ["codigo item", "codigo unico", "codigo producto", "sku", "codigo"] },
  { id: "proveedor", label: "Proveedor", required: true, aliases: ["proveedor", "supplier", "vendor"] },
  { id: "codigo_proveedor", label: "Codigo proveedor", aliases: ["codigo proveedor", "codigo prov", "sku proveedor"] },
  { id: "precio_lista", label: "Precio lista proveedor", aliases: ["precio lista proveedor", "precio lista", "precio proveedor"] },
  { id: "estado_stock", label: "Estado stock", aliases: ["estado stock", "stock estado"] },
  { id: "cantidad_stock", label: "Cantidad stock", aliases: ["cantidad stock", "stock cantidad", "cantidad disponible"] },
  { id: "stock_informado", label: "Stock informado", aliases: ["stock informado", "stock texto", "disponibilidad"] },
];

const normalizeHeader = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const initialMappings = () => Object.fromEntries(
  FIELDS.map((field) => [field.id, { csvHeader: "" }])
) as Record<string, Mapping>;

function detectMappings(headers: string[]) {
  const mappings = initialMappings();
  const usedHeaders = new Set<string>();

  FIELDS.forEach((field) => {
    const match = headers.find((header) => {
      if (usedHeaders.has(header)) return false;
      const normalized = normalizeHeader(header);
      return field.aliases.some((alias) => normalized === normalizeHeader(alias));
    });
    if (match) {
      mappings[field.id] = { csvHeader: match };
      usedHeaders.add(match);
    }
  });

  return mappings;
}

function getHeaders(sheet: XLSX.WorkSheet) {
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  const headers: string[] = [];
  for (let column = range.s.c; column <= range.e.c; column += 1) {
    const cell = sheet[XLSX.utils.encode_cell({ r: range.s.r, c: column })];
    if (cell?.v !== undefined && String(cell.v).trim()) headers.push(String(cell.v));
  }
  return headers;
}

export function ImportProviderPricesPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [mappings, setMappings] = useState<Record<string, Mapping>>(initialMappings);
  const [processed, setProcessed] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);

  const requiredMapped = FIELDS
    .filter((field) => field.required)
    .every((field) => Boolean(mappings[field.id]?.csvHeader));
  const mappedCount = FIELDS.filter((field) => Boolean(mappings[field.id]?.csvHeader)).length;

  const sample = (header: string) => {
    const value = rows.find((row) => String(row[header] ?? "").trim())?.[header];
    return value === undefined || value === null || String(value).trim() === "" ? "Sin ejemplo" : String(value);
  };

  const setParsedFile = (name: string, nextHeaders: string[], nextRows: Record<string, unknown>[]) => {
    if (!nextHeaders.length) throw new Error("El archivo no tiene encabezados.");
    if (!nextRows.length) throw new Error("El archivo no tiene filas para importar.");
    setFileName(name);
    setHeaders(nextHeaders);
    setRows(nextRows);
    setMappings(detectMappings(nextHeaders));
    setStep("mapping");
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      if (/\.(xlsx|xls)$/i.test(file.name)) {
        const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
        const sheetName = workbook.SheetNames.find((name) => normalizeHeader(name) === "precios proveedores") ?? workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) throw new Error("No se encontro una hoja para importar.");
        setParsedFile(file.name, getHeaders(sheet), XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" }));
        return;
      }

      Papa.parse<Record<string, unknown>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (parsed) => {
          try {
            setParsedFile(file.name, parsed.meta.fields ?? [], parsed.data);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se pudo leer el archivo.");
          }
        },
        error: () => toast.error("No se pudo leer el archivo CSV."),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo leer el archivo.");
    } finally {
      event.target.value = "";
    }
  };

  const startImport = async () => {
    if (!requiredMapped) {
      toast.error("Mapea Codigo Item y Proveedor para continuar.");
      return;
    }

    try {
      setStep("importing");
      setProcessed(0);
      const accumulated: ImportResult = {
        updated: 0,
        pricesUpdated: 0,
        stockUpdated: 0,
        recalculated: 0,
        ignored: 0,
        errors: [],
      };
      const batchSize = 500;

      for (let index = 0; index < rows.length; index += batchSize) {
        const batch = rows.slice(index, index + batchSize);
        const response = await fetch("/api/productos/import/precios-proveedores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: batch, mappings }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "No se pudieron importar los precios de proveedor.");

        accumulated.updated += Number(data.updated || 0);
        accumulated.pricesUpdated += Number(data.pricesUpdated || 0);
        accumulated.stockUpdated += Number(data.stockUpdated || 0);
        accumulated.recalculated += Number(data.recalculated || 0);
        accumulated.ignored += Number(data.ignored || 0);
        accumulated.errors.push(...(data.errors || []));
        setProcessed(Math.min(index + batch.length, rows.length));
      }

      setResult(accumulated);
      setStep("results");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron importar los precios de proveedor.");
      setStep("mapping");
    }
  };

  const missingProviders = useMemo(() => {
    const groups = new Map<string, Set<string>>();
    (result?.errors || []).forEach((error) => {
      if (!/^Proveedor no encontrado:/i.test(error.error)) return;
      const codes = groups.get(error.proveedor) ?? new Set<string>();
      codes.add(error.codigo_item);
      groups.set(error.proveedor, codes);
    });
    return Array.from(groups.entries()).map(([provider, codes]) => ({ provider, codes: Array.from(codes) }));
  }, [result]);

  if (step === "results" && result) {
    const otherErrors = result.errors.filter((error) => !/^Proveedor no encontrado:/i.test(error.error));
    return (
      <main className="min-h-[calc(100dvh-4rem)] bg-white p-4 dark:bg-black md:p-6">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5">
          <section className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5">
            <div className="flex items-center gap-2 text-emerald-500"><HiCheck className="h-5 w-5" /><h1 className="text-sm font-black uppercase tracking-wide">Resultado de la importacion</h1></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <Metric label="Asociaciones actualizadas" value={result.updated} tone="emerald" />
              <Metric label="Precios actualizados" value={result.pricesUpdated} tone="blue" />
              <Metric label="Stock actualizado" value={result.stockUpdated} tone="blue" />
              <Metric label="Costos recalculados" value={result.recalculated} tone="violet" />
              <Metric label="Sin aplicar" value={result.ignored} tone="red" />
            </div>
          </section>

          {missingProviders.length > 0 && (
            <section className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
              <h2 className="text-[11px] font-black uppercase tracking-widest text-amber-300">Proveedores no encontrados</h2>
              <div className="mt-3 space-y-2 text-xs text-amber-100">
                {missingProviders.map((group) => <p key={group.provider}><strong>{group.provider}:</strong> {group.codes.join(", ")}</p>)}
              </div>
            </section>
          )}

          {otherErrors.length > 0 && (
            <section className="rounded-xl border border-red-500/25 bg-red-500/5 p-4">
              <h2 className="text-[11px] font-black uppercase tracking-widest text-red-300">Filas sin aplicar</h2>
              <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                {otherErrors.slice(0, 100).map((error, index) => <p key={`${error.row}-${index}`} className="rounded-lg border border-red-500/15 bg-slate-950/30 px-3 py-2 text-xs text-red-100"><strong>Fila {error.row}:</strong> {error.error} <span className="ml-2 font-mono text-[10px] text-red-300/70">{error.codigo_item}</span></p>)}
              </div>
            </section>
          )}

          <button type="button" onClick={() => router.push("/configuracion/catalogo")} className="h-11 rounded-lg bg-white px-5 text-xs font-black uppercase tracking-wide text-slate-950 transition hover:bg-slate-200">Volver a catalogo</button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-white p-4 dark:bg-black md:p-6">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5">
        <header className="border-b border-slate-200 pb-4 dark:border-slate-800">
          <button type="button" onClick={() => router.push("/configuracion/catalogo")} className="mb-3 inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 transition hover:text-slate-900 dark:hover:text-white"><HiArrowLeft className="h-4 w-4" /> Volver a catalogo</button>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Importar precios de proveedores</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">Usa la hoja <strong>Precios proveedores</strong> del Excel exportado. Solo actualiza items y proveedores que ya existen.</p>
        </header>

        {step === "upload" && (
          <label className="flex min-h-72 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 text-center transition hover:border-blue-500 hover:bg-blue-500/5 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-blue-500">
            <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileChange} />
            <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500"><HiCloudUpload className="h-7 w-7" /></span>
            <span className="mt-4 text-lg font-black text-slate-900 dark:text-white">Seleccionar CSV o Excel</span>
            <span className="mt-2 text-xs font-medium text-slate-500">Codigo de item, proveedor, precio y disponibilidad.</span>
          </label>
        )}

        {step === "mapping" && (
          <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
              <div><h2 className="text-base font-black text-slate-900 dark:text-white">Mapeo de columnas</h2><p className="mt-1 text-xs text-slate-500">{fileName} · {rows.length} filas</p></div>
              <button type="button" onClick={() => setMappings(detectMappings(headers))} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-blue-500/25 bg-blue-500/10 px-3 text-[10px] font-black uppercase tracking-widest text-blue-600 transition hover:bg-blue-500/20 dark:text-blue-300"><HiRefresh className="h-4 w-4" /> Detectar otra vez</button>
            </div>
            <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800"><div className="min-w-[720px] overflow-hidden">
              <div className="grid grid-cols-[minmax(180px,0.7fr)_minmax(270px,1.2fr)_minmax(160px,0.7fr)] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:border-slate-800 dark:bg-slate-900/40"><span>Campo</span><span>Columna</span><span>Ejemplo</span></div>
              {FIELDS.map((field) => {
                const header = mappings[field.id]?.csvHeader ?? "";
                return <div key={field.id} className="grid grid-cols-[minmax(180px,0.7fr)_minmax(270px,1.2fr)_minmax(160px,0.7fr)] items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 dark:border-slate-800"><span className="text-xs font-black text-slate-800 dark:text-slate-100">{field.label}{field.required && <span className="ml-1 text-red-500">*</span>}</span><select value={header} onChange={(event) => setMappings((current) => ({ ...current, [field.id]: { csvHeader: event.target.value } }))} className="h-10 min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"><option value="">No importar</option>{headers.map((item) => <option key={item} value={item}>{item}</option>)}</select><span className="truncate text-xs text-slate-500">{header ? sample(header) : "Sin mapear"}</span></div>;
              })}
            </div></div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className={`text-xs font-bold ${requiredMapped ? "text-emerald-500" : "text-amber-500"}`}>{mappedCount}/{FIELDS.length} columnas mapeadas</p><div className="flex gap-2"><button type="button" onClick={() => setStep("upload")} className="h-10 rounded-lg border border-slate-300 px-4 text-xs font-black text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900">Cambiar archivo</button><button type="button" onClick={startImport} disabled={!requiredMapped} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-xs font-black uppercase tracking-wide text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"><HiPlay className="h-4 w-4" /> Importar</button></div></div>
          </section>
        )}
      </div>
      <TransferProgressModal open={step === "importing"} title="Importando precios de proveedores" description={`Sincronizando ${rows.length} filas y recalculando costos.`} total={rows.length} processed={processed} unit="filas" />
    </main>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: "emerald" | "blue" | "violet" | "red" }) {
  const tones = {
    emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
    blue: "border-blue-500/20 bg-blue-500/10 text-blue-400",
    violet: "border-violet-500/20 bg-violet-500/10 text-violet-400",
    red: "border-red-500/20 bg-red-500/10 text-red-400",
  };
  return <div className={`rounded-lg border p-4 ${tones[tone]}`}><p className="text-3xl font-black">{value}</p><p className="mt-1 text-[10px] font-black uppercase tracking-widest opacity-70">{label}</p></div>;
}
