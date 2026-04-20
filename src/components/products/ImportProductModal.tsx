"use client";

import { useState, useMemo } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import { HiCloudUpload, HiCheck, HiExclamation, HiX, HiDownload, HiChevronRight, HiAdjustments, HiPlay } from "react-icons/hi";
import { useRouter } from "next/navigation";



interface ImportError {
  row: number;
  error: string;
  cod_unico: string;
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
  updateExisting: boolean;
  isRequired?: boolean;
}

const SYSTEM_FIELDS = [
  { id: 'cod_unico', label: 'Código Interno (Identificador)', required: true },
  { id: 'titulo', label: 'Título / Descripción' },
  { id: 'cod_barra', label: 'Código de Barras' },
  { id: 'stock', label: 'Stock Actual' },
  { id: 'marca', label: 'Marca' },
  { id: 'subcategoria', label: 'Subcategoría' },
  { id: 'ubicacion', label: 'Ubicación Interna' },
  { id: 'codigo_pieza', label: 'Código de Pieza / Parte' },
  { id: 'palabra_clave', label: 'Palabras Clave' },
  { id: 'proveedor', label: 'Proveedor' },
  { id: 'codigo_proveedor', label: 'Código en Proveedor' },
];

export function ImportProductModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [preview, setPreview] = useState<any[]>([]);
  const [mappings, setMappings] = useState<Record<string, MappingConfig>>(() => {
    const initial: Record<string, MappingConfig> = {};
    SYSTEM_FIELDS.forEach(f => {
      initial[f.id] = { csvHeader: '', updateExisting: true, isRequired: f.required };
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
            if (h === 'codigo' || h === 'cod_unico' || h === 'codigointerno' || h === 'sku') newMappings.cod_unico.csvHeader = header;
            if (h === 'titulo' || h === 'descripcion' || h === 'nombre') newMappings.titulo.csvHeader = header;
            if (h === 'stock' || h === 'cantidad') newMappings.stock.csvHeader = header;
            if (h === 'marca') newMappings.marca.csvHeader = header;
            if (h === 'proveedor') newMappings.proveedor.csvHeader = header;
            if (h === 'ubicacion' || h === 'pasillo') newMappings.ubicacion.csvHeader = header;
            if (h === 'codigo_barra' || h === 'cod_barra' || h === 'ean') newMappings.cod_barra.csvHeader = header;
          });
          setMappings(newMappings);
          setStep('mapping');
        }
      },
    });
  };

  const handleImport = async () => {
    if (!file) return;

    try {
      setStep('importing');
      setImporting(true);
      const startTime = Date.now();

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (allData) => {
          const totalItems = allData.data.length;
          setTotalRows(totalItems);
          const BATCH_SIZE = 500;
          let accumulatedResults: ImportResults = {
            imported: 0,
            updated: 0,
            ignored: 0,
            errors: []
          };

          for (let i = 0; i < totalItems; i += BATCH_SIZE) {
            const chunk = allData.data.slice(i, i + BATCH_SIZE);
            try {
              const res = await fetch("/api/productos/import", {
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
                  cod_unico: `Lote ${Math.floor(i / BATCH_SIZE) + 1}`
                });
              }
            } catch (err: any) {
              accumulatedResults.errors.push({ row: i + 1, error: err.message, cod_unico: "ERROR RED" });
            }
            setProcessedCount(Math.min(i + BATCH_SIZE, totalItems));
          }

          const durationMs = Date.now() - startTime;
          const minutes = Math.floor(durationMs / 60000);
          const seconds = ((durationMs % 60000) / 1000).toFixed(1);
          setImportDuration(minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`);
          setResults(accumulatedResults);

          try {
            await fetch("/api/productos/import/log", {
              method: "POST",
              body: JSON.stringify({
                ...accumulatedResults,
                durationMs,
                fileName: file.name
              })
            });
          } catch (e) {
            console.error("Error al guardar log unificado:", e);
          }

          setStep('results');
          setImporting(false);
          router.refresh();
        }
      });
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

  const toggleUpdate = (fieldId: string) => {
    setMappings(prev => ({
      ...prev,
      [fieldId]: { ...prev[fieldId], updateExisting: !prev[fieldId].updateExisting }
    }));
  };

  // Renderizado por pasos
  if (step === 'results' && results) {
    return (
      <div className="flex flex-col gap-6 p-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-2xl bg-green-500/10 p-5 border border-green-500/20">
            <span className="block text-3xl font-black text-green-500">{results.imported}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-green-500/60">Nuevos</span>
          </div>
          <div className="rounded-2xl bg-blue-500/10 p-5 border border-blue-500/20">
            <span className="block text-3xl font-black text-blue-500">{results.updated}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-500/60">Actualizados</span>
          </div>
          <div className="rounded-2xl bg-red-500/10 p-5 border border-red-500/20">
            <span className="block text-3xl font-black text-red-500">{results.errors.length}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-red-500/60">Con Errores</span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 rounded-xl bg-zinc-800/50 p-2 border border-zinc-700/50">
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Tiempo total transcurrido:</span>
          <span className="text-xs font-black text-zinc-200">{importDuration}</span>
        </div>

        {results.errors.length > 0 && (
          <div className="max-h-[300px] overflow-y-auto rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
            <h4 className="mb-3 text-[10px] font-black uppercase tracking-widest text-red-500">Log de errores</h4>
            <div className="space-y-2">
              {results.errors.slice(0, 100).map((err, i) => (
                <div key={i} className="flex gap-2 text-xs text-red-400 p-2 bg-black/20 rounded-lg border border-red-500/10">
                  <span className="font-bold shrink-0">Fila {err.row}:</span>
                  <span className="opacity-80">{err.error}</span>
                </div>
              ))}
              {results.errors.length > 100 && <p className="text-[10px] text-center text-zinc-500 py-2">Y {results.errors.length - 100} errores más...</p>}
            </div>
          </div>
        )}

        <button onClick={onClose} className="h-14 w-full rounded-2xl bg-white font-black text-zinc-900 transition hover:bg-zinc-200">
          Cerrar Importador
        </button>
      </div>
    );
  }

  if (step === 'mapping') {
  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800">
        <div>
          <h3 className="text-lg font-black text-white">Configuración de Columnas</h3>
          <p className="text-xs text-zinc-400">Mapea los datos de tu CSV a los campos de la base de datos.</p>
        </div>
        <div className="h-12 w-12 flex items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
          <HiAdjustments className="h-6 w-6" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 max-h-[500px] overflow-y-auto pr-3 px-1 scrollbar-thin scrollbar-thumb-zinc-700">
        {SYSTEM_FIELDS.map((field) => (
          <div
            key={field.id}
            className="flex flex-col gap-3 rounded-2xl bg-zinc-900/30 p-4 border border-zinc-800 hover:border-zinc-700 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-300">
                {field.label} {field.required && <span className="text-red-500">*</span>}
              </span>

              {field.id !== 'cod_unico' && (
                <label className="flex items-center gap-2 cursor-pointer group">
                  <span
                    className={`text-[9px] font-bold transition-colors ${
                      mappings[field.id].updateExisting
                        ? 'text-blue-400'
                        : 'text-zinc-600 line-through'
                    }`}
                  >
                    {mappings[field.id].updateExisting ? 'SINCRONIZAR' : 'OMITIR CAMPO'}
                  </span>

                  <input
                    type="checkbox"
                    checked={mappings[field.id].updateExisting}
                    onChange={() => toggleUpdate(field.id)}
                    className="sr-only"
                  />

                  <div
                    className={`w-8 h-4 rounded-full transition-colors relative ${
                      mappings[field.id].updateExisting ? 'bg-blue-600' : 'bg-red-500/20'
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 w-3 h-3 rounded-full transition-transform ${
                        mappings[field.id].updateExisting
                          ? 'bg-white translate-x-[18px]'
                          : 'bg-zinc-500 translate-x-0.5'
                      }`}
                    />
                  </div>
                </label>
              )}
            </div>

            {mappings[field.id].updateExisting && (
              <select
                value={mappings[field.id].csvHeader}
                onChange={(e) => updateMapping(field.id, e.target.value)}
                className={`h-11 w-full rounded-xl border bg-zinc-900 px-3 text-xs font-bold ring-offset-zinc-900 transition focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  mappings[field.id].csvHeader
                    ? 'border-blue-500/50 text-white'
                    : 'border-zinc-800 text-zinc-500'
                }`}
              >
                <option value="">-- IGNORAR ESTE CAMPO --</option>
                {csvHeaders.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-4 pt-2">
        <button
          onClick={() => setStep('upload')}
          className="h-14 flex-1 rounded-2xl bg-zinc-800 font-bold text-zinc-300 transition hover:bg-zinc-700 border border-zinc-700"
        >
          Atrás
        </button>

        <button
          onClick={handleImport}
          disabled={!mappings.cod_unico.csvHeader}
          className="h-14 flex-[2] flex items-center justify-center gap-3 rounded-2xl bg-blue-600 font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 disabled:opacity-50"
        >
          <HiPlay className="h-6 w-6" />
          Iniciar Procesamiento
        </button>
      </div>
    </div>
  );
}

  if (step === 'importing') {
    return (
      <div className="flex flex-col items-center justify-center gap-10 py-12 animate-in zoom-in duration-500">
        <div className="relative">
          <div className="h-40 w-40 animate-spin rounded-full border-4 border-zinc-800 border-t-blue-500" />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-black text-white">
              {Math.round((processedCount / (totalRows || 1)) * 100)}%
            </span>
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Status</span>
          </div>
        </div>
        <div className="text-center max-w-sm">
          <h3 className="text-xl font-black text-white mb-2">Procesando {file?.name}</h3>
          <p className="text-sm text-zinc-400 leading-relaxed italic">&quot;Sincronizando registros con alta fidelidad...&quot;</p>

          <div className="mt-8 flex flex-col gap-3">
            <div className="flex justify-between text-[11px] font-bold uppercase tracking-widest px-1">
              <span className="text-blue-400">{processedCount}</span>
              <span className="text-zinc-600">DE</span>
              <span className="text-zinc-300">{totalRows} PRODUCTOS</span>
            </div>
            <div className="h-2 w-72 overflow-hidden rounded-full bg-zinc-800 p-0.5 border border-zinc-700">
              <div
                className="h-full bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-all duration-300"
                style={{ width: `${(processedCount / (totalRows || 1)) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <label className="group relative flex h-56 cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 transition hover:border-blue-400 hover:bg-blue-50/50 dark:border-slate-800 dark:bg-slate-950">
          <input type="file" className="hidden" accept=".csv" onChange={handleFileChange} />
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-100 transition group-hover:scale-110 group-hover:ring-blue-200 dark:bg-slate-900 dark:ring-slate-800">
            <HiCloudUpload className="h-8 w-8 text-blue-500" />
          </div>
          <span className="text-base font-black text-slate-900 dark:text-white">Seleccionar archivo CSV</span>
          <span className="mt-1 text-xs font-medium text-slate-400">Arrastra tu archivo aquí o haz clic para buscar</span>
        </label>

        <button
          onClick={() => {
            const headers = "codigoInterno,marca,titulo,stock,ubicacionInt,codigoProveedor,CodigoBarras,Palabra clave,Proveedor";
            const blob = new Blob([headers], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "plantilla_productos.csv";
            a.click();
          }}
          className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-600 hover:underline dark:text-blue-400"
        >
          <HiDownload /> Descargar plantilla ejemplo
        </button>
      </div>

      <div className="rounded-2xl bg-amber-50 p-4 border border-amber-100 dark:bg-amber-900/20 dark:border-amber-800/40">
        <div className="flex gap-3">
          <HiExclamation className="h-5 w-5 text-amber-500 shrink-0" />
          <div>
            <p className="text-[11px] font-bold text-amber-800 dark:text-amber-400 leading-tight">Personalización de importación:</p>
            <p className="mt-1 text-[10px] text-amber-700 dark:text-amber-500 opacity-80">
              En el siguiente paso podrás elegir exactamente qué columnas de tu Excel corresponden a cada campo del sistema y decidir si quieres actualizar los productos existentes o solo añadir los nuevos.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
