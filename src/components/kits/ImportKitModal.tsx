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
}

type Step = 'upload' | 'mapping' | 'importing' | 'results';

interface MappingConfig {
  csvHeader: string;
  isRequired?: boolean;
}

const KIT_FIELDS = [
  { id: 'codigo_kit', label: 'Código del Kit', required: true },
  { id: 'nombre_kit', label: 'Nombre del Kit' },
  { id: 'cod_producto', label: 'Código del Item (Componente)', required: true },
  { id: 'cantidad', label: 'Cantidad' },
];

export function ImportKitModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [preview, setPreview] = useState<any[]>([]);
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

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
          const headers: string[] = [];
          for (let C = range.s.c; C <= range.e.c; ++C) {
            const address = XLSX.utils.encode_col(C) + '1';
            const cell = worksheet[address];
            if (cell && cell.v !== undefined) {
              headers.push(cell.v.toString());
            }
          }
          
          setCsvHeaders(headers);
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          setPreview(jsonData.slice(0, 5));
          setTotalRows(jsonData.length);

          // Auto-mapeo inteligente
          const newMappings = { ...mappings };
          headers.forEach(header => {
            const h = header.toLowerCase().trim();
            if (h.includes('codigo_kit') || h === 'cod_kit' || h === 'kit_id') newMappings.codigo_kit.csvHeader = header;
            if (h.includes('nombre_kit') || h === 'kit_nombre' || h === 'nombre') newMappings.nombre_kit.csvHeader = header;
            if (h.includes('cod_producto') || h === 'producto' || h === 'sku' || h === 'articulo') newMappings.cod_producto.csvHeader = header;
            if (h.includes('cantidad') || h === 'cant' || h === 'qty') newMappings.cantidad.csvHeader = header;
          });
          setMappings(newMappings);
          setStep('mapping');
        } catch (err) {
          toast.error("Error al leer el archivo Excel");
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
            setTotalRows(results.data.length);

            // Auto-mapeo inteligente
            const newMappings = { ...mappings };
            results.meta.fields.forEach(header => {
              const h = header.toLowerCase().trim();
              if (h.includes('codigo_kit') || h === 'cod_kit' || h === 'kit_id') newMappings.codigo_kit.csvHeader = header;
              if (h.includes('nombre_kit') || h === 'kit_nombre' || h === 'nombre') newMappings.nombre_kit.csvHeader = header;
              if (h.includes('cod_producto') || h === 'producto' || h === 'sku' || h === 'articulo') newMappings.cod_producto.csvHeader = header;
              if (h.includes('cantidad') || h === 'cant' || h === 'qty') newMappings.cantidad.csvHeader = header;
            });
            setMappings(newMappings);
            setStep('mapping');
          }
        },
      });
    }
  };

  const handleImport = async () => {
    if (!file) return;

    try {
      setStep('importing');
      setImporting(true);
      const startTime = Date.now();

      const processImportData = async (allData: { data: any[] }) => {
        const totalItems = allData.data.length;
        setTotalRows(totalItems);
        const BATCH_SIZE = 1000;
        let accumulatedResults: ImportResults = {
          imported: 0,
          updated: 0,
          ignored: 0,
          errors: []
        };

        for (let i = 0; i < totalItems; i += BATCH_SIZE) {
          const chunk = allData.data.slice(i, i + BATCH_SIZE);
          try {
            const res = await fetch("/api/kits/import", {
              method: "POST",
              body: JSON.stringify({
                items: chunk,
                mappings,
                fileName: file.name
              }),
            });

            const data = await res.json();
            if (res.ok) {
              accumulatedResults.imported += (data.imported || 0);
              accumulatedResults.updated += (data.updated || 0);
              accumulatedResults.ignored += (data.ignored || 0);
              accumulatedResults.errors = [...accumulatedResults.errors, ...data.errors];
            } else {
              accumulatedResults.errors.push({
                row: i + 1,
                error: data.message || "Error en el lote",
                cod_kit: `Batch ${Math.floor(i / BATCH_SIZE) + 1}`
              });
            }
          } catch (err: any) {
            accumulatedResults.errors.push({ row: i + 1, error: err.message, cod_kit: "ERROR RED" });
          }
          setProcessedCount(Math.min(i + BATCH_SIZE, totalItems));
        }

        const durationMs = Date.now() - startTime;
        const minutes = Math.floor(durationMs / 60000);
        const seconds = ((durationMs % 60000) / 1000).toFixed(1);
        setImportDuration(minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`);
        setResults(accumulatedResults);
        setStep('results');
        setImporting(false);
        router.refresh();
      };

      const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

      if (isExcel) {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const data = e.target?.result;
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            await processImportData({ data: jsonData });
          } catch (err) {
            toast.error("Error al leer el archivo Excel");
            setImporting(false);
            setStep('upload');
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: async (allData) => {
            await processImportData(allData);
          }
        });
      }
    } catch (error: any) {
      toast.error("Error crítico: " + error.message);
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
            <p>El CSV debe contener el <strong>Código del Kit</strong> y el <strong>Código del Item</strong> por cada componente.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
