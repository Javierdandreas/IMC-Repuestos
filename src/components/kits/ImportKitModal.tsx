"use client";

import { useState, useMemo } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { HiCloudUpload, HiCheck, HiExclamation, HiX, HiDownload, HiChevronRight, HiAdjustments, HiPlay } from "react-icons/hi";
import { useRouter } from "next/navigation";
import { TransferProgressModal } from "@/components/ui/TransferProgressModal";

interface ImportError {
  row: number;
  error: string;
  cod_kit: string;
}

interface ImportResults {
  imported: number;
  updated: number;
  ignored: number;
  errors: ImportError[];
  categoriesCreated?: string[];
  subcategoriesCreated?: string[];
}

type Step = 'upload' | 'mapping' | 'importing' | 'results';

interface MappingConfig {
  csvHeader: string;
  isRequired?: boolean;
}

const KIT_FIELDS = [
  { id: 'codigo_kit', label: 'Código del Kit', required: true },
  { id: 'nombre_kit', label: 'Nombre del Kit' },
  { id: 'descripcion_kit', label: 'Descripción del Kit' },
  { id: 'categoria_kit', label: 'Categoría del Kit' },
  { id: 'subcategoria_kit', label: 'Subcategoría del Kit' },
  { id: 'activo_kit', label: 'Activo' },
  { id: 'cod_producto', label: 'Código del Item (Componente)', required: true },
  { id: 'cantidad', label: 'Cantidad' },
];

const normalizeHeader = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "")
  .trim();

const findHeader = (headers: string[], ...candidates: string[]) => headers.find((header) => {
  const normalized = normalizeHeader(header);
  return candidates.some((candidate) => normalized === normalizeHeader(candidate));
});

export function ImportKitModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [preview, setPreview] = useState<any[]>([]);
  const [importRows, setImportRows] = useState<any[]>([]);
  const [mappings, setMappings] = useState<Record<string, MappingConfig>>(() => {
    const initial: Record<string, MappingConfig> = {};
    KIT_FIELDS.forEach(f => {
      initial[f.id] = { csvHeader: '', isRequired: f.required };
    });
    return initial;
  });

  const [importing, setImporting] = useState(false);
  const [totalRows, setTotalRows] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [importDuration, setImportDuration] = useState<string | null>(null);
  const [results, setResults] = useState<ImportResults | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      parseFileHeaders(selectedFile);
    }
  };

  const parseFileHeaders = (file: File) => {
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    const applyAutoMapping = (headers: string[]) => {
      const nextMappings: Record<string, MappingConfig> = {};
      KIT_FIELDS.forEach((field) => {
        nextMappings[field.id] = { csvHeader: '', isRequired: field.required };
      });

      nextMappings.codigo_kit.csvHeader = findHeader(headers, 'Codigo Kit', 'Código Kit', 'Cod Kit', 'Kit ID') || '';
      nextMappings.nombre_kit.csvHeader = findHeader(headers, 'Nombre Kit', 'Nombre') || '';
      nextMappings.descripcion_kit.csvHeader = findHeader(headers, 'Descripcion', 'Descripción', 'Descripcion Kit', 'Descripción Kit') || '';
      nextMappings.categoria_kit.csvHeader = findHeader(headers, 'Categoria', 'Categoría', 'Categoria Kit', 'Categoría Kit') || '';
      nextMappings.subcategoria_kit.csvHeader = findHeader(headers, 'Subcategoria', 'Subcategoría', 'Subcategoria Kit', 'Subcategoría Kit') || '';
      nextMappings.activo_kit.csvHeader = findHeader(headers, 'Activo', 'Estado') || '';
      nextMappings.cod_producto.csvHeader = findHeader(headers, 'Codigo Item', 'Código Item', 'Codigo Producto', 'Código Producto', 'SKU', 'Articulo', 'Artículo') || '';
      nextMappings.cantidad.csvHeader = findHeader(headers, 'Cantidad', 'Cant', 'Qty') || '';

      setMappings(nextMappings);
    };

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'array' });
          const componentsSheetName = workbook.SheetNames.find((name) => normalizeHeader(name) === normalizeHeader('Componentes kits')) || workbook.SheetNames[0];
          const kitsSheetName = workbook.SheetNames.find((name) => normalizeHeader(name) === normalizeHeader('Kits'));
          const componentRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[componentsSheetName], { defval: '' });
          const kitRows = kitsSheetName
            ? XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[kitsSheetName], { defval: '' })
            : [];

          const kitCodeHeader = findHeader(
            Array.from(new Set(kitRows.flatMap((row) => Object.keys(row)))),
            'Codigo Kit',
            'Código Kit',
            'Cod Kit',
            'Kit ID'
          );
          const kitMetadataByCode = new Map<string, Record<string, unknown>>();
          if (kitCodeHeader) {
            kitRows.forEach((row) => {
              const code = String(row[kitCodeHeader] ?? '').trim().toUpperCase();
              if (code) kitMetadataByCode.set(code, row);
            });
          }

          const rows = componentRows.map((component) => {
            const componentCodeHeader = findHeader(Object.keys(component), 'Codigo Kit', 'Código Kit', 'Cod Kit', 'Kit ID');
            const code = componentCodeHeader ? String(component[componentCodeHeader] ?? '').trim().toUpperCase() : '';
            return { ...(kitMetadataByCode.get(code) || {}), ...component };
          });
          const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));

          if (rows.length === 0) throw new Error('No hay componentes de kits para importar');
          setCsvHeaders(headers);
          setPreview(rows.slice(0, 5));
          setImportRows(rows);
          setTotalRows(rows.length);
          applyAutoMapping(headers);
          setStep('mapping');
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Error al leer el archivo Excel');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.meta.fields) {
            setCsvHeaders(results.meta.fields);
            setPreview(results.data.slice(0, 5));
            setImportRows(results.data as Record<string, unknown>[]);
            setTotalRows(results.data.length);
            applyAutoMapping(results.meta.fields);
            setStep('mapping');
          }
        },
      });
    }
  };

  const handleImport = async () => {
    if (!file || importRows.length === 0) return;

    try {
      setStep('importing');
      setImporting(true);
      setProcessedCount(0);
      const startTime = Date.now();
      setTotalRows(importRows.length);

      // Nunca se separan los componentes de un mismo kit entre dos pedidos.
      const rowsByKit = new Map<string, Record<string, unknown>[]>();
      importRows.forEach((row, index) => {
        const code = String(row[mappings.codigo_kit.csvHeader] ?? '').trim().toUpperCase();
        const key = code || `__fila_${index}`;
        const group = rowsByKit.get(key) || [];
        group.push(row);
        rowsByKit.set(key, group);
      });

      const batches: Record<string, unknown>[][] = [];
      let currentBatch: Record<string, unknown>[] = [];
      for (const rows of rowsByKit.values()) {
        if (currentBatch.length > 0 && currentBatch.length + rows.length > 500) {
          batches.push(currentBatch);
          currentBatch = [];
        }
        currentBatch.push(...rows);
      }
      if (currentBatch.length > 0) batches.push(currentBatch);

      const accumulatedResults: ImportResults = {
        imported: 0,
        updated: 0,
        ignored: 0,
        errors: [],
        categoriesCreated: [],
        subcategoriesCreated: [],
      };
      let processed = 0;

      for (let index = 0; index < batches.length; index += 1) {
        const batch = batches[index];
        try {
          const response = await fetch('/api/kits/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: batch, mappings, fileName: file.name }),
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.message || 'Error al importar el lote');

          accumulatedResults.imported += Number(data.imported || 0);
          accumulatedResults.updated += Number(data.updated || 0);
          accumulatedResults.ignored += Number(data.ignored || 0);
          accumulatedResults.errors.push(...(data.errors || []));
          accumulatedResults.categoriesCreated?.push(...(data.categoriesCreated || []));
          accumulatedResults.subcategoriesCreated?.push(...(data.subcategoriesCreated || []));
        } catch (error) {
          accumulatedResults.errors.push({
            row: processed + 2,
            error: error instanceof Error ? error.message : 'Error de red',
            cod_kit: `Lote ${index + 1}`,
          });
        }
        processed += batch.length;
        setProcessedCount(processed);
      }

      const durationMs = Date.now() - startTime;
      const minutes = Math.floor(durationMs / 60000);
      const seconds = ((durationMs % 60000) / 1000).toFixed(1);
      setImportDuration(minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`);
      setResults(accumulatedResults);
      setStep('results');
      router.refresh();
    } catch (error: any) {
      toast.error("Error crítico: " + error.message);
      setStep('mapping');
    } finally {
      setImporting(false);
    }
  };

  const updateMapping = (fieldId: string, header: string) => {
    setMappings(prev => ({
      ...prev,
      [fieldId]: { ...prev[fieldId], csvHeader: header }
    }));
  };

  if (step === 'results' && results) {
    return (
      <div className="flex flex-col gap-6 p-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-2xl bg-emerald-500/10 p-5 border border-emerald-500/20">
            <span className="block text-3xl font-black text-emerald-500">{results.imported}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500/60">Nuevos Kits</span>
          </div>
          <div className="rounded-2xl bg-blue-500/10 p-5 border border-blue-500/20">
            <span className="block text-3xl font-black text-blue-500">{results.updated}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-500/60">Actualizados</span>
          </div>
          <div className="rounded-2xl bg-red-500/10 p-5 border border-red-500/20">
            <span className="block text-3xl font-black text-red-500">{results.errors.length}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-red-500/60">Errores</span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 rounded-xl bg-slate-100 dark:bg-slate-800/50 p-2 border border-slate-200 dark:border-slate-700/50">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Tiempo total:</span>
          <span className="text-xs font-black text-slate-900 dark:text-white">{importDuration}</span>
        </div>

        {results.errors.length > 0 && (
          <div className="max-h-[300px] overflow-y-auto rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
            <h4 className="mb-3 text-[10px] font-black uppercase tracking-widest text-red-500">Log de errores</h4>
            <div className="space-y-2">
              {results.errors.slice(0, 100).map((err, i) => (
                <div key={i} className="flex gap-2 text-xs text-red-400 p-2 bg-black/20 rounded-lg border border-red-500/10">
                  <span className="font-bold shrink-0">Fila {err.row}:</span>
                  <span className="opacity-80">{err.error}</span>
                  <span className="font-mono text-[10px] ml-auto">{err.cod_kit}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button onClick={onClose} className="h-14 w-full rounded-2xl bg-indigo-600 font-black text-white transition hover:bg-indigo-700 shadow-xl shadow-indigo-600/20">
          Cerrar Importador
        </button>
      </div>
    );
  }

  if (step === 'mapping') {
    return (
      <div className="flex flex-col gap-5 animate-in fade-in duration-300">
        <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">Mapeo de Kits</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Vincula las columnas de tu CSV con los campos del sistema.</p>
          </div>
          <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
            <HiAdjustments className="h-5 w-5" />
          </div>
        </div>

        <div className="space-y-3 max-h-[400px] overflow-y-auto px-1">
          {KIT_FIELDS.map((field) => (
            <div key={field.id} className="flex flex-col gap-2 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950/50">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                {field.label} {field.required && <span className="text-red-500">*</span>}
              </span>
              <select
                value={mappings[field.id].csvHeader}
                onChange={(e) => updateMapping(field.id, e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none transition"
              >
                <option value="">-- SELECCIONAR COLUMNA --</option>
                {csvHeaders.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={() => setStep('upload')} className="h-12 flex-1 rounded-2xl bg-white dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs">
            Atrás
          </button>
          <button
            onClick={handleImport}
            disabled={!mappings.codigo_kit.csvHeader || !mappings.cod_producto.csvHeader}
            className="h-12 flex-[2] flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 font-black text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 disabled:opacity-50 text-xs uppercase tracking-widest transition-all"
          >
            <HiPlay className="h-5 w-5" />
            Iniciar Importación
          </button>
        </div>
      </div>
    );
  }

  if (step === 'importing') {
    return <TransferProgressModal open title="Importando kits" description={`Procesando ${file?.name || "el archivo"}.`} total={totalRows} processed={processedCount} unit="filas" />;
  }

  return (
    <div className="flex flex-col gap-6">
      <label className="group relative flex h-64 cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 transition hover:border-indigo-400 hover:bg-indigo-50/50 dark:border-slate-800 dark:bg-slate-950">
        <input type="file" className="hidden" accept=".csv, .xlsx, .xls" onChange={handleFileChange} />
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-100 transition group-hover:scale-110 dark:bg-slate-900 dark:ring-slate-800">
          <HiCloudUpload className="h-8 w-8 text-indigo-500" />
        </div>
        <span className="text-base font-black text-slate-900 dark:text-white">Cargar CSV o Excel de Kits</span>
        <span className="mt-1 text-xs font-medium text-slate-400">Sube tu archivo para importar combos masivamente</span>
      </label>

      <div className="rounded-2xl bg-indigo-50 p-4 border border-indigo-100 dark:bg-indigo-900/20 dark:border-indigo-800/40">
        <div className="flex gap-3">
          <HiExclamation className="h-5 w-5 text-indigo-500 shrink-0" />
          <div className="text-xs text-indigo-700 dark:text-indigo-400 font-medium">
            <p className="font-black uppercase tracking-tight mb-1">Formato requerido:</p>
            <p>En CSV se requiere <strong>Código del Kit</strong> y <strong>Código del Item</strong>. En el Excel exportado se unen solas las hojas <strong>Kits</strong> y <strong>Componentes kits</strong>.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
