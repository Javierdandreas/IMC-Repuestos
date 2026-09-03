"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, FileUp, Upload } from "lucide-react";
import { toast } from "sonner";
import { useAppError } from "@/context/AppErrorContext";
import { TransferProgressModal } from "@/components/ui/TransferProgressModal";
import type { ImportSeriesMapping, ImportSeriesResult } from "@/interfaces/series-import";
import { SERIE_ESTADO_LABELS, SERIE_ESTADOS_PERMITIDOS } from "@/lib/serie-estados";

type Step = "upload" | "mapping" | "importing" | "results";

type FieldDef = {
  id: keyof ImportSeriesMapping;
  label: string;
  required?: boolean;
  help: string;
};

const FIELDS: FieldDef[] = [
  { id: "codigo_producto", label: "Codigo item", required: true, help: "Codigo unico del item." },
  { id: "serie", label: "Serie", required: true, help: "Numero de serie a crear o actualizar." },
  { id: "ubicacion", label: "Ubicacion", help: "Si se omite, usa SIN UBICACION." },
  { id: "estado", label: "Estado", help: "Si se omite, usa DISPONIBLE." },
];

const TEMPLATE_HEADERS = ["codigo_producto", "serie", "ubicacion", "estado"];

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "_");
}

function createInitialMappings(headers: string[] = []): ImportSeriesMapping {
  const mappings: ImportSeriesMapping = {
    codigo_producto: { csvHeader: "" },
    serie: { csvHeader: "" },
    ubicacion: { csvHeader: "" },
    estado: { csvHeader: "" },
  };

  headers.forEach((header) => {
    const normalized = normalizeHeader(header);
    if (["codigo_producto", "cod_producto", "cod_unico", "codigo", "sku"].includes(normalized)) {
      mappings.codigo_producto = { csvHeader: header };
    }
    if (["serie", "numero_serie", "serial", "nro_serie"].includes(normalized)) {
      mappings.serie = { csvHeader: header };
    }
    if (["ubicacion", "ubicacion_interna", "pasillo"].includes(normalized)) {
      mappings.ubicacion = { csvHeader: header };
    }
    if (["estado", "estado_serie"].includes(normalized)) {
      mappings.estado = { csvHeader: header };
    }
  });

  return mappings;
}

export function ImportSeriesInventoryPage() {
  const router = useRouter();
  const { showError, showMessage } = useAppError();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [preview, setPreview] = useState<any[]>([]);
  const [mappings, setMappings] = useState<ImportSeriesMapping>(() => createInitialMappings());
  const [result, setResult] = useState<ImportSeriesResult | null>(null);

  const canImport = Boolean(mappings.codigo_producto?.csvHeader && mappings.serie?.csvHeader);

  const selectedHeaders = useMemo(
    () => new Set(Object.values(mappings).map((mapping) => mapping?.csvHeader).filter(Boolean)),
    [mappings]
  );

  const reset = () => {
    setStep("upload");
    setFile(null);
    setHeaders([]);
    setRows([]);
    setPreview([]);
    setMappings(createInitialMappings());
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const parseRows = (fileRows: any[], fileHeaders: string[], selectedFile: File) => {
    setFile(selectedFile);
    setHeaders(fileHeaders);
    setRows(fileRows);
    setPreview(fileRows.slice(0, 8));
    setMappings(createInitialMappings(fileHeaders));
    setStep("mapping");
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    const isExcel = selectedFile.name.endsWith(".xlsx") || selectedFile.name.endsWith(".xls");

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (readerEvent) => {
        try {
          const workbook = XLSX.read(readerEvent.target?.result, { type: "array" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const data = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as any[];
          const fileHeaders = data.length > 0 ? Object.keys(data[0]) : [];
          parseRows(data, fileHeaders, selectedFile);
        } catch (error) {
          showError(error, "No se pudo leer el archivo Excel");
        }
      };
      reader.readAsArrayBuffer(selectedFile);
      return;
    }

    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (parseResult) => {
        parseRows(parseResult.data as any[], parseResult.meta.fields ?? [], selectedFile);
      },
      error: (error) => showError(error, "No se pudo leer el archivo CSV"),
    });
  };

  const updateMapping = (field: keyof ImportSeriesMapping, csvHeader: string) => {
    setMappings((prev) => ({
      ...prev,
      [field]: { csvHeader },
    }));
  };

  const handleImport = async () => {
    if (!canImport) {
      showMessage("Mapea Codigo item y Serie antes de importar.");
      return;
    }

    setStep("importing");
    try {
      const res = await fetch("/api/ubicaciones/inventario/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: rows,
          mappings,
          fileName: file?.name ?? "series_ubicaciones.csv",
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.message || "No se pudo importar el archivo");

      setResult(payload);
      setStep("results");
      toast.success("Importacion procesada");
      router.refresh();
    } catch (error) {
      setStep("mapping");
      showError(error, "No se pudo importar el archivo");
    }
  };

  const downloadTemplate = () => {
    const csv = Papa.unparse([
      {
        codigo_producto: "COD-001",
        serie: "SERIE-001",
        ubicacion: "SIN UBICACION",
        estado: "DISPONIBLE",
      },
    ], { columns: TEMPLATE_HEADERS });
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "plantilla_series_ubicaciones.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link
            href="/ubicaciones/inventario"
            className="mb-3 inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Inventario
          </Link>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Importar series</h1>
          <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
            Carga o corrige ubicaciones y estados desde CSV o Excel.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {step === "mapping" && (
            <button
              type="button"
              onClick={reset}
              className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black uppercase tracking-widest text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900"
            >
              Cambiar archivo
            </button>
          )}
          {step === "mapping" && (
            <button
              type="button"
              onClick={handleImport}
              disabled={!canImport}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-500 disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              Importar
            </button>
          )}
          {step === "results" && (
            <Link
              href="/ubicaciones/inventario"
              className="inline-flex h-11 items-center rounded-xl bg-slate-900 px-5 text-xs font-black uppercase tracking-widest text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            >
              Volver al inventario
            </Link>
          )}
        </div>
      </div>

      {step === "upload" && (
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <label className="flex min-h-[360px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white p-8 text-center shadow-sm transition hover:border-blue-400 hover:bg-blue-50/40 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-blue-500">
            <FileUp className="mb-4 h-12 w-12 text-slate-400" />
            <span className="text-sm font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">Seleccionar CSV o Excel</span>
            <span className="mt-2 text-xs font-medium text-slate-500">CSV, XLSX o XLS</span>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileChange} />
          </label>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Columnas esperadas</h2>
              <div className="mt-4 space-y-3">
                {FIELDS.map((field) => (
                  <div key={field.id} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/70">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">
                      {field.label}{field.required ? " *" : ""}
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{field.help}</p>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={downloadTemplate}
                className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-[10px] font-black uppercase tracking-widest text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
              >
                <Download className="h-4 w-4" />
                Plantilla CSV
              </button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Estados validos</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {SERIE_ESTADOS_PERMITIDOS.map((estado) => (
                  <span key={estado} className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {SERIE_ESTADO_LABELS[estado]}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {step === "mapping" && (
        <div className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Archivo</p>
              <p className="mt-1 truncate text-sm font-black text-slate-900 dark:text-white" title={file?.name}>{file?.name}</p>
              <p className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400">{rows.length} filas detectadas</p>

              <div className="mt-5 space-y-2">
                {FIELDS.map((field) => (
                  <div key={field.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-900/70">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{field.label}</span>
                    <span className={`h-2 w-2 rounded-full ${mappings[field.id]?.csvHeader ? "bg-green-500" : field.required ? "bg-red-500" : "bg-slate-300"}`} />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Mapeo de columnas</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {FIELDS.map((field) => (
                  <div key={field.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                    <label className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">
                      {field.label}{field.required ? " *" : ""}
                    </label>
                    <select
                      value={mappings[field.id]?.csvHeader ?? ""}
                      onChange={(event) => updateMapping(field.id, event.target.value)}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold uppercase text-slate-900 outline-none transition focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    >
                      <option value="">No importar este campo</option>
                      {headers.map((header) => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                    <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">{field.help}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Vista previa</h2>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {selectedHeaders.size} columnas mapeadas
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-left text-xs">
                <thead className="bg-slate-50 font-black uppercase tracking-widest text-slate-400 dark:bg-slate-900/70">
                  <tr>
                    {headers.map((header) => (
                      <th key={header} className={`px-3 py-2 ${selectedHeaders.has(header) ? "text-blue-500" : ""}`}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {preview.map((row, index) => (
                    <tr key={index}>
                      {headers.map((header) => (
                        <td key={header} className={`max-w-[220px] truncate px-3 py-2 font-medium ${selectedHeaders.has(header) ? "text-slate-900 dark:text-white" : "text-slate-400"}`}>
                          {String(row[header] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <TransferProgressModal open={step === "importing"} title="Importando series" total={rows.length} unit="filas" />

      {step === "results" && result && (
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Creadas</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white">{result.created}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Actualizadas</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white">{result.updated}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ignoradas</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white">{result.ignored}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Errores</p>
              <p className="text-2xl font-black text-red-600">{result.errors.length}</p>
            </div>
          </div>

          {result.errors.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-red-200 bg-white shadow-sm dark:border-red-900/50 dark:bg-slate-950">
              <div className="flex items-center gap-2 bg-red-50 px-4 py-3 text-xs font-black uppercase tracking-widest text-red-600 dark:bg-red-900/20">
                <AlertTriangle className="h-4 w-4" />
                Errores por fila
              </div>
              <div className="max-h-[520px] overflow-y-auto">
                {result.errors.map((error) => (
                  <div key={`${error.row}-${error.serie}`} className="grid grid-cols-[80px_1fr_1fr_2fr] gap-2 border-t border-red-100 px-4 py-2 text-xs dark:border-red-900/30">
                    <span className="font-black text-red-600">Fila {error.row}</span>
                    <span className="font-mono text-slate-600 dark:text-slate-300">{error.codigo_producto}</span>
                    <span className="font-mono text-slate-600 dark:text-slate-300">{error.serie}</span>
                    <span className="font-bold text-slate-700 dark:text-slate-200">{error.error}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-700 dark:border-green-900/50 dark:bg-green-900/20 dark:text-green-300">
              <CheckCircle2 className="h-5 w-5" />
              No hubo errores en la importacion.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
