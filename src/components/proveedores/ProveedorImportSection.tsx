"use client";

import { useMemo, useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { HiCheck, HiCloudUpload, HiExclamation, HiPlay, HiTable } from "react-icons/hi";
import { mutate } from "swr";

import { ProveedorImportHistory } from "./ProveedorImportHistory";
import { TransferProgressModal } from "@/components/ui/TransferProgressModal";

type Step = "upload" | "mapping" | "importing" | "results";

interface ImportResults {
  total: number;
  updatedCount: number;
  recalculatedCostCount: number;
  notFoundCount: number;
  invalidCount: number;
  duplicateCount: number;
  providerMismatchCount: number;
}

interface MappingConfig {
  csvHeader: string;
  isRequired?: boolean;
}

interface Props {
  id_proveedor: number;
  nombre_proveedor: string;
  onSuccess?: () => void;
  hideHistory?: boolean;
  compact?: boolean;
}

const SUPPLIER_FIELDS = [
  { id: "proveedor", label: "Proveedor", required: true },
  { id: "codigo_proveedor", label: "Codigo proveedor", required: true },
  { id: "precio_lista", label: "Precio de lista", required: true },
];

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function detectHeader(headers: string[], fieldId: string) {
  const candidates = fieldId === "proveedor"
    ? [
        { terms: ["proveedor"], score: 100 },
        { terms: ["razon social"], score: 95 },
        { terms: ["empresa"], score: 90 },
        { terms: ["nombre proveedor"], score: 90 },
        { terms: ["cuit"], score: 80 },
        { terms: ["dni"], score: 75 },
      ]
    : fieldId === "codigo_proveedor"
    ? [
        { terms: ["codigo proveedor"], score: 100 },
        { terms: ["cod proveedor"], score: 95 },
        { terms: ["codigo prov"], score: 90 },
        { terms: ["cod prov"], score: 85 },
        { terms: ["sku"], score: 65 },
        { terms: ["referencia"], score: 60 },
        { terms: ["ref"], score: 55 },
        { terms: ["codigo"], score: 45 },
      ]
    : [
        { terms: ["precio lista"], score: 100 },
        { terms: ["precio proveedor"], score: 95 },
        { terms: ["lista"], score: 85 },
        { terms: ["precio compra"], score: 75 },
        { terms: ["costo"], score: 65 },
        { terms: ["precio"], score: 55 },
      ];

  const best = headers
    .map((header) => {
      const normalized = normalizeHeader(header);
      const match = candidates.find((candidate) => candidate.terms.some((term) => normalized.includes(term)));
      return { header, score: match?.score ?? 0 };
    })
    .sort((a, b) => b.score - a.score)[0];

  return best?.score ? best.header : "";
}

function parseSupplierPrice(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  let clean = raw.replace(/[^0-9,.-]/g, "");
  if (!clean || clean === "-" || clean === "," || clean === ".") return null;

  const lastComma = clean.lastIndexOf(",");
  const lastDot = clean.lastIndexOf(".");

  if (lastComma >= 0 && lastDot >= 0) {
    clean = lastComma > lastDot
      ? clean.replace(/\./g, "").replace(",", ".")
      : clean.replace(/,/g, "");
  } else if (lastComma >= 0) {
    clean = clean.replace(",", ".");
  }

  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildMappedRows(rows: any[], mappings: Record<string, MappingConfig>) {
  const supplierHeader = mappings.proveedor?.csvHeader;
  const codeHeader = mappings.codigo_proveedor?.csvHeader;
  const priceHeader = mappings.precio_lista?.csvHeader;
  const preview: Array<{ row: number; proveedor: string; codigo: string; precio: number | null; status: "OK" | "ERROR"; reason: string }> = [];
  const items: Array<{ fila: number; proveedor_archivo: string; codigo_proveedor: string; precio_lista: number | null; precio_original: string }> = [];
  let invalidCount = 0;

  if (!supplierHeader || !codeHeader || !priceHeader) {
    return { preview, items, invalidCount: rows.length };
  }

  rows.forEach((row, index) => {
    const proveedor = String(row?.[supplierHeader] ?? "").trim();
    const codigo = String(row?.[codeHeader] ?? "").trim().toUpperCase();
    const precioOriginal = String(row?.[priceHeader] ?? "").trim();
    const precio = parseSupplierPrice(row?.[priceHeader]);
    let reason = "";

    if (!proveedor) reason = "Sin proveedor";
    if (!codigo) reason = "Sin codigo";
    if (precio === null) reason = reason ? `${reason} y sin precio` : "Sin precio";
    if (precio !== null && precio < 0) reason = reason ? `${reason} y precio negativo` : "Precio negativo";

    if (reason) {
      invalidCount += 1;
    }

    items.push({
      fila: index + 2,
      proveedor_archivo: proveedor,
      codigo_proveedor: codigo,
      precio_lista: precio,
      precio_original: precioOriginal,
    });

    if (preview.length < 6) {
      preview.push({
        row: index + 2,
        proveedor,
        codigo,
        precio,
        status: reason ? "ERROR" : "OK",
        reason: reason || "Lista para validar",
      });
    }
  });

  return { preview, items, invalidCount };
}

function createInitialMappings(): Record<string, MappingConfig> {
  const initial: Record<string, MappingConfig> = {};
  SUPPLIER_FIELDS.forEach((field) => {
    initial[field.id] = { csvHeader: "", isRequired: field.required };
  });
  return initial;
}

export function ProveedorImportSection({ id_proveedor, nombre_proveedor, onSuccess, hideHistory, compact }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [mappings, setMappings] = useState<Record<string, MappingConfig>>(() => createInitialMappings());
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResults | null>(null);

  const mappedData = useMemo(() => buildMappedRows(rawRows, mappings), [rawRows, mappings]);
  const canImport = Boolean(mappings.proveedor.csvHeader && mappings.codigo_proveedor.csvHeader && mappings.precio_lista.csvHeader && mappedData.items.length > 0);

  const applyHeadersAndRows = (headers: string[], rows: any[]) => {
    setCsvHeaders(headers);
    setRawRows(rows);
    setResults(null);
    setMappings({
      proveedor: { csvHeader: detectHeader(headers, "proveedor"), isRequired: true },
      codigo_proveedor: { csvHeader: detectHeader(headers, "codigo_proveedor"), isRequired: true },
      precio_lista: { csvHeader: detectHeader(headers, "precio_lista"), isRequired: true },
    });
    setStep("mapping");
  };

  const parseFileHeaders = (selectedFile: File) => {
    const isExcel = selectedFile.name.endsWith(".xlsx") || selectedFile.name.endsWith(".xls");

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const workbook = XLSX.read(event.target?.result, { type: "array" });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
          const headers: string[] = [];
          for (let column = range.s.c; column <= range.e.c; column += 1) {
            const cell = worksheet[XLSX.utils.encode_col(column) + "1"];
            if (cell?.v !== undefined) headers.push(String(cell.v));
          }
          applyHeadersAndRows(headers, XLSX.utils.sheet_to_json(worksheet));
        } catch {
          toast.error("Error al leer el archivo Excel");
        }
      };
      reader.readAsArrayBuffer(selectedFile);
      return;
    }

    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (parseResult) => {
        if (!parseResult.meta.fields?.length) {
          toast.error("No se detectaron columnas en el archivo");
          return;
        }
        applyHeadersAndRows(parseResult.meta.fields, parseResult.data as any[]);
      },
      error: () => toast.error("Error al leer el archivo CSV"),
    });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    parseFileHeaders(selectedFile);
  };

  const updateMapping = (fieldId: string, header: string) => {
    setMappings((prev) => ({
      ...prev,
      [fieldId]: { ...prev[fieldId], csvHeader: header },
    }));
  };

  const handleImport = async () => {
    if (!file) return;
    if (!mappings.proveedor.csvHeader || !mappings.codigo_proveedor.csvHeader || !mappings.precio_lista.csvHeader) {
      toast.error("Selecciona las columnas de proveedor, codigo y precio antes de importar");
      return;
    }
    if (mappedData.items.length === 0) {
      toast.error("No hay filas para importar");
      return;
    }

    try {
      setStep("importing");
      setImporting(true);

      const response = await fetch("/api/proveedores/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_proveedor,
          nombre_archivo: file.name,
          items: mappedData.items,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || data.error || "Error al importar");
      }

      const updatedCount = Number(data.updatedCount || 0);
      const recalculatedCostCount = Number(data.recalculatedCostCount || 0);
      const notFoundCount = Number(data.notFoundCount || 0);
      const invalidCount = Number(data.invalidCount || 0);
      const duplicateCount = Number(data.duplicateCount || 0);
      const providerMismatchCount = Number(data.providerMismatchCount || 0);

      setResults({
        total: mappedData.items.length,
        updatedCount,
        recalculatedCostCount,
        notFoundCount,
        invalidCount,
        duplicateCount,
        providerMismatchCount,
      });
      toast.success(
        recalculatedCostCount > 0
          ? `Lista aplicada. ${updatedCount} precios y ${recalculatedCostCount} costos recalculados.`
          : `Lista aplicada. ${updatedCount} precios actualizados.`
      );
      setStep("results");
      onSuccess?.();
      mutate(`/api/proveedores/importaciones?id_proveedor=${id_proveedor}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al importar");
      setStep("mapping");
    } finally {
      setImporting(false);
    }
  };

  const renderStats = () => (
    <div className="grid grid-cols-3 gap-2">
      <div className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2">
        <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">Filas</div>
        <div className="text-sm font-black text-white">{rawRows.length}</div>
      </div>
      <div className="rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-2">
        <div className="text-[9px] font-black uppercase tracking-widest text-green-400">A validar</div>
        <div className="text-sm font-black text-green-300">{mappedData.items.length}</div>
      </div>
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2">
        <div className="text-[9px] font-black uppercase tracking-widest text-amber-400">Con aviso</div>
        <div className="text-sm font-black text-amber-300">{mappedData.invalidCount}</div>
      </div>
    </div>
  );

  const renderPreview = () => (
    <div className="overflow-hidden rounded-xl border border-slate-800">
      <div className="grid grid-cols-[60px_minmax(130px,1fr)_minmax(110px,0.8fr)_110px_130px] gap-3 bg-slate-950/60 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
        <span>Fila</span>
        <span>Proveedor</span>
        <span>Codigo</span>
        <span>Precio</span>
        <span>Estado</span>
      </div>
      {mappedData.preview.length === 0 ? (
        <div className="px-3 py-3 text-xs font-bold text-slate-500">Selecciona columnas para ver una vista previa.</div>
      ) : (
        <div className="divide-y divide-slate-800">
          {mappedData.preview.map((row) => (
            <div key={row.row} className="grid grid-cols-[60px_minmax(130px,1fr)_minmax(110px,0.8fr)_110px_130px] items-center gap-3 px-3 py-2 text-xs">
              <span className="font-mono font-bold text-slate-500">{row.row}</span>
              <span className="truncate font-bold text-slate-300">{row.proveedor || "-"}</span>
              <span className="truncate font-black text-white">{row.codigo || "-"}</span>
              <span className="font-mono font-black text-blue-300">{row.precio === null ? "-" : row.precio}</span>
              <span className={row.status === "OK" ? "font-black text-green-300" : "font-black text-amber-300"}>
                {row.reason}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderMapping = () => (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-xs font-black text-white">{file?.name}</div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{nombre_proveedor}</div>
        </div>
        <label className="inline-flex h-9 cursor-pointer items-center justify-center rounded-lg border border-slate-700 px-3 text-[10px] font-black uppercase tracking-widest text-slate-300 transition hover:bg-slate-900">
          <input type="file" className="hidden" accept=".csv,.xlsx,.xls" onChange={handleFileChange} />
          Cambiar archivo
        </label>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {SUPPLIER_FIELDS.map((field) => (
          <div key={field.id} className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-blue-400">{field.label}</label>
            <select
              value={mappings[field.id].csvHeader}
              onChange={(event) => updateMapping(field.id, event.target.value)}
              className="h-10 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 text-xs font-black text-white outline-none transition focus:border-blue-500"
            >
              <option value="">No importar</option>
              {csvHeaders.map((header) => (
                <option key={header} value={header}>{header}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {renderStats()}
      {renderPreview()}

      <button
        type="button"
        onClick={handleImport}
        disabled={!canImport || importing}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-blue-500 disabled:opacity-50"
      >
        <HiPlay className="h-4 w-4" />
        Importar {mappedData.items.length} filas
      </button>
    </div>
  );

  const renderUpload = () => (
    <div className={compact ? "space-y-3" : "flex flex-col gap-4"}>
      <div className={`${compact ? "rounded-xl px-4 py-7" : "rounded-2xl p-6"} border border-dashed border-slate-700 bg-slate-900/35 transition hover:border-blue-500/70 hover:bg-slate-900/55`}>
        <label className="flex cursor-pointer flex-col items-center justify-center text-center">
          <input type="file" className="hidden" accept=".csv,.xlsx,.xls" onChange={handleFileChange} />
          <div className={`${compact ? "h-14 w-14 rounded-2xl" : "h-16 w-16 rounded-2xl"} flex items-center justify-center bg-slate-800 text-white ring-1 ring-slate-700`}>
            <HiCloudUpload className={compact ? "h-7 w-7" : "h-8 w-8"} />
          </div>
          <h3 className={`${compact ? "text-sm" : "text-base"} mt-4 font-black uppercase tracking-tight text-white`}>Cargar lista de precios</h3>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Sube tu archivo CSV o Excel del proveedor</p>
          <span className="mt-4 inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-white px-5 text-[10px] font-black uppercase tracking-widest text-black shadow-sm transition hover:bg-slate-100">
            <HiTable className="h-4 w-4" />
            Seleccionar archivo
          </span>
        </label>
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
        <div className="flex items-start gap-2">
          <HiExclamation className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div>
            <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-300">Recomendaciones</h4>
            <ul className="mt-2 space-y-1 text-[11px] font-bold leading-relaxed text-amber-400">
              <li>El archivo puede estar en formato CSV o Excel.</li>
              <li>Debe tener columnas claras para codigo y precio.</li>
              <li>La columna proveedor debe coincidir con el proveedor abierto.</li>
              <li>El orden no importa, podras mapearlas en el siguiente paso.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep = () => {
    if (step === "importing") return null;

    if (step === "results" && results) {
      return (
        <div className="space-y-3">
          <div className="rounded-xl border border-green-500/20 bg-green-500/10 px-3 py-3 text-xs font-black text-green-300">
            <div className="flex items-center gap-2">
              <HiCheck className="h-4 w-4" />
              Lista aplicada: {results.updatedCount} precios actualizados.
            </div>
          </div>
          {results.recalculatedCostCount > 0 && (
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-3 text-xs font-black text-blue-300">
              {results.recalculatedCostCount} item(s) con criterio automatico recalcularon costo y precios de venta.
            </div>
          )}
          {results.notFoundCount > 0 && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-3 text-xs font-black text-amber-300">
              {results.notFoundCount} fila(s) no encontraron item con ese codigo en este proveedor.
            </div>
          )}
          {(results.invalidCount > 0 || results.duplicateCount > 0 || results.providerMismatchCount > 0) && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-3 text-xs font-black text-amber-300">
              {results.invalidCount} invalida(s), {results.duplicateCount} duplicada(s), {results.providerMismatchCount} de otro proveedor.
            </div>
          )}
          <button
            type="button"
            onClick={() => setStep("upload")}
            className="h-9 rounded-lg border border-slate-700 px-3 text-[10px] font-black uppercase tracking-widest text-slate-300 transition hover:bg-slate-900"
          >
            Importar otra
          </button>
        </div>
      );
    }

    if (step === "mapping") return renderMapping();
    return renderUpload();
  };

  return (
    <div className="flex flex-col gap-6">
      {renderStep()}
      <TransferProgressModal open={importing} title="Importando lista de precios" total={mappedData.items.length} unit="filas" />

      {!hideHistory && (
        <div className="mt-4">
          <div className="mb-4 flex items-center gap-2">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Historial de importaciones</h3>
          </div>
          <ProveedorImportHistory id_proveedor={id_proveedor} />
        </div>
      )}
    </div>
  );
}
