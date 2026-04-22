"use client";

import { useState } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import { 
  HiCloudUpload, 
  HiCheck, 
  HiExclamation, 
  HiAdjustments, 
  HiPlay,
  HiTable
} from "react-icons/hi";

import { mutate } from "swr";
import { ProveedorImportHistory } from "./ProveedorImportHistory";

interface ImportError {
  row: number;
  error: string;
  codigo_proveedor: string;
}

interface ImportResults {
  total: number;
  errors: ImportError[];
}

type Step = 'upload' | 'mapping' | 'importing' | 'results';

interface MappingConfig {
  csvHeader: string;
  isRequired?: boolean;
}

const SUPPLIER_FIELDS = [
  { id: 'codigo_proveedor', label: 'Código Proveedor', required: true },
  { id: 'precio_lista', label: 'Precio de Lista', required: true },
];

interface Props {
  id_proveedor: number;
  nombre_proveedor: string;
  onSuccess?: () => void;
}

export function ProveedorImportSection({ id_proveedor, nombre_proveedor, onSuccess }: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<Record<string, MappingConfig>>(() => {
    const initial: Record<string, MappingConfig> = {};
    SUPPLIER_FIELDS.forEach(f => {
      initial[f.id] = { csvHeader: '', isRequired: f.required };
    });
    return initial;
  });

  const [importing, setImporting] = useState(false);
  const [totalRows, setTotalRows] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
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
          setTotalRows(results.data.length);

          // Auto-mapping
          const newMappings = { ...mappings };
          results.meta.fields.forEach(header => {
            const h = header.toLowerCase().trim();
            if (h.includes('codigo') || h.includes('sku') || h.includes('ref')) newMappings.codigo_proveedor.csvHeader = header;
            if (h.includes('precio') || h.includes('lista') || h.includes('costo')) newMappings.precio_lista.csvHeader = header;
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

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (allData) => {
          const rawItems = allData.data;
          
          // Mapear los datos según la configuración
          const mappedItems = rawItems.map((row: any) => {
            const item: any = {};
            SUPPLIER_FIELDS.forEach(f => {
              const csvHeader = mappings[f.id].csvHeader;
              if (csvHeader) {
                let value = row[csvHeader];
                if (f.id === 'precio_lista') {
                  value = parseFloat(String(value).replace(/[^0-9.,]/g, '').replace(',', '.')) || 0;
                }
                item[f.id] = value;
              }
            });
            return item;
          }).filter((i: any) => i.codigo_proveedor);

          try {
            const res = await fetch("/api/proveedores/importar", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id_proveedor,
                nombre_archivo: file.name,
                items: mappedItems
              }),
            });

            const data = await res.json();
            if (res.ok) {
              setResults({ total: mappedItems.length, errors: [] });
              toast.success("Lista importada correctamente");
              
              // Refrescar historial
              mutate(`/api/proveedores/importaciones?id_proveedor=${id_proveedor}`);
              
              if (onSuccess) onSuccess();
            } else {
              throw new Error(data.message || "Error al importar");
            }
          } catch (err: any) {
            toast.error(err.message);
            setStep('mapping');
          } finally {
            setImporting(false);
            setStep('results');
          }
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

  const renderStep = () => {
    if (step === 'results' && results) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 py-8 animate-in fade-in zoom-in duration-300">
          <div className="h-20 w-20 flex items-center justify-center rounded-full bg-green-500/10 text-green-500 border border-green-500/20">
            <HiCheck className="h-10 w-10" />
          </div>
          <div className="text-center">
            <h3 className="text-xl font-black text-slate-900 dark:text-white">Importación Finalizada</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Se han procesado <strong>{results.total}</strong> ítems para {nombre_proveedor}.
            </p>
          </div>
          <button
            onClick={() => setStep('upload')}
            className="mt-4 px-8 py-3 rounded-xl bg-slate-900 text-white font-bold transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            Importar otra lista
          </button>
        </div>
      );
    }

    if (step === 'mapping') {
      const canImport = mappings.codigo_proveedor.csvHeader && mappings.precio_lista.csvHeader;

      return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-300">
          <div className="flex items-center justify-between bg-blue-50/50 dark:bg-blue-500/5 rounded-2xl p-4 border border-blue-100 dark:border-blue-500/20">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-blue-500 text-white shadow-lg">
                <HiAdjustments className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Mapeo de Columnas</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Vincula las columnas de tu archivo con los campos del sistema.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SUPPLIER_FIELDS.map((field) => (
              <div key={field.id} className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">
                  {field.label} {field.required && <span className="text-red-500">*</span>}
                </label>
                <select
                  value={mappings[field.id].csvHeader}
                  onChange={(e) => updateMapping(field.id, e.target.value)}
                  className={`h-11 w-full rounded-xl border px-3 text-xs font-bold transition focus:outline-none focus:ring-4 focus:ring-blue-500/10 ${mappings[field.id].csvHeader
                      ? 'bg-white border-blue-500 text-slate-900 dark:bg-slate-900 dark:text-white'
                      : 'bg-slate-50 border-slate-200 text-slate-400 dark:bg-slate-900/50 dark:border-slate-800'
                    }`}
                >
                  <option value="">-- OMITIR --</option>
                  {csvHeaders.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setStep('upload')}
              className="flex-1 h-12 rounded-xl border border-slate-200 font-bold text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              Atrás
            </button>
            <button
              onClick={handleImport}
              disabled={!canImport || importing}
              className="flex-[2] h-12 flex items-center justify-center gap-2 rounded-xl bg-blue-600 font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 disabled:opacity-50 uppercase tracking-widest text-xs"
            >
              <HiPlay className="h-5 w-5" />
              {importing ? "Procesando..." : "Comenzar Importación"}
            </button>
          </div>
        </div>
      );
    }

    if (step === 'importing') {
      return (
        <div className="flex flex-col items-center justify-center py-12 gap-6 animate-pulse">
          <div className="h-16 w-16 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
          <div className="text-center">
            <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-widest">Importando Lista</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Esto puede tomar unos segundos dependiendo del tamaño del archivo...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-6">
        <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-10 transition hover:border-blue-400 hover:bg-blue-50/20 dark:border-slate-800 dark:bg-slate-900/20">
          <label className="flex flex-col items-center justify-center cursor-pointer group">
            <input type="file" className="hidden" accept=".csv" onChange={handleFileChange} />
            <div className="h-20 w-20 flex items-center justify-center rounded-2xl bg-white shadow-xl ring-1 ring-slate-100 transition group-hover:scale-110 group-hover:ring-blue-200 dark:bg-slate-800 dark:ring-slate-700">
              <HiCloudUpload className="h-10 w-10 text-blue-500" />
            </div>
            <div className="mt-6 text-center">
              <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Cargar lista de precios</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">Sube tu archivo CSV con los productos del proveedor.</p>
            </div>
            <div className="mt-8 flex items-center gap-2 rounded-full bg-blue-500 px-6 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-blue-500/30 transition group-hover:bg-blue-600">
              <HiTable className="h-4 w-4" />
              Seleccionar Archivo
            </div>
          </label>
        </div>

        <div className="flex gap-4 p-5 rounded-2xl bg-amber-50 border border-amber-100 dark:bg-amber-900/10 dark:border-amber-800/30">
          <HiExclamation className="h-6 w-6 text-amber-500 shrink-0" />
          <div>
            <h4 className="text-xs font-black uppercase tracking-widest text-amber-900 dark:text-amber-400">Recomendaciones:</h4>
            <ul className="mt-2 space-y-1.5 text-[11px] text-amber-700 dark:text-amber-500 font-medium list-disc pl-4">
              <li>El archivo debe estar en formato **CSV**.</li>
              <li>Asegúrate de que las columnas de **Código** y **Precio** sean legibles.</li>
              <li>No importa el orden de las columnas, podrás mapearlas en el siguiente paso.</li>
            </ul>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {renderStep()}

      <div className="mt-4">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Historial de Importaciones</h3>
        </div>
        <ProveedorImportHistory id_proveedor={id_proveedor} />
      </div>
    </div>
  );
}
