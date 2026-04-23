"use client";

import { useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
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
  hideHistory?: boolean;
}

export function ProveedorImportSection({ id_proveedor, nombre_proveedor, onSuccess, hideHistory }: Props) {
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
          setTotalRows(jsonData.length);

          // Auto-mapping
          const newMappings = { ...mappings };
          headers.forEach(header => {
            const h = header.toLowerCase().trim();
            if (h.includes('codigo') || h.includes('sku') || h.includes('ref')) newMappings.codigo_proveedor.csvHeader = header;
            if (h.includes('precio') || h.includes('lista') || h.includes('costo')) newMappings.precio_lista.csvHeader = header;
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
    }
  };

  const handleImport = async () => {
    if (!file) return;

    try {
      setStep('importing');
      setImporting(true);

      const processImportData = async (allData: { data: any[] }) => {
        // Mapear y limpiar datos en el frontend
        const mappedItems = allData.data.map((row: any) => {
          const item: any = {};
          SUPPLIER_FIELDS.forEach(f => {
            const csvHeader = mappings[f.id].csvHeader;
            if (csvHeader) {
              let value = row[csvHeader];
              if (f.id === 'precio_lista') {
                // Limpiar precio (quitar símbolos, convertir comas a puntos)
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
            toast.success("Lista importada correctamente al historial");
            setStep('results');
            if (onSuccess) onSuccess();
            mutate(`/api/proveedores/importaciones?id_proveedor=${id_proveedor}`);
          } else {
            throw new Error(data.message || "Error al importar");
          }
        } catch (err: any) {
          toast.error(err.message);
          setStep('mapping');
        } finally {
          setImporting(false);
        }
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
            toast.error("Error al leer Excel");
            setImporting(false);
            setStep('upload');
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: async (results) => {
            await processImportData(results);
          }
        });
      }
    } catch (error: any) {
      toast.error("Error: " + error.message);
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
          <div className="h-20 w-20 flex items-center justify-center rounded-full bg-white/10 text-white border border-white/20">
            <HiCheck className="h-10 w-10" />
          </div>
          <div className="text-center">
            <h3 className="text-xl font-black text-white">Importación Finalizada</h3>
            <p className="text-sm text-slate-400 mt-1">
              Se han procesado <strong>{results.total}</strong> ítems para {nombre_proveedor}.
            </p>
          </div>
          <button
            onClick={() => setStep('upload')}
            className="mt-4 px-8 py-3 rounded-2xl bg-slate-200 text-black font-black uppercase tracking-widest text-[10px] transition hover:bg-white shadow-sm active:scale-95"
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {SUPPLIER_FIELDS.map((field) => (
              <div key={field.id} className="flex flex-col gap-2.5">
                <label className="text-sm font-black uppercase tracking-[0.2em] text-white px-1">
                  {field.label} <span className="text-red-500 font-bold">*</span>
                </label>
                <select
                  value={mappings[field.id].csvHeader}
                  onChange={(e) => updateMapping(field.id, e.target.value)}
                  className={`h-14 w-full rounded-2xl border-2 px-4 text-xs font-black transition outline-none tracking-widest ${mappings[field.id].csvHeader
                    ? 'bg-slate-900 border-white text-white'
                    : 'bg-slate-900/50 border-slate-700 text-slate-400'
                    } focus:border-white focus:ring-4 focus:ring-white/5`}
                >
                  <option value="">-- OMITIR --</option>
                  {csvHeaders.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="flex gap-4 pt-6">
            <button
              onClick={() => setStep('upload')}
              className="flex-1 h-14 rounded-2xl border-2 border-slate-700 bg-slate-900 font-black uppercase tracking-widest text-[10px] text-white transition hover:bg-slate-800 active:scale-95"
            >
              Atrás
            </button>
            <button
              onClick={handleImport}
              disabled={!canImport || importing}
              className="flex-[2] h-14 flex items-center justify-center gap-3 rounded-2xl bg-slate-300 text-black font-black uppercase tracking-widest text-[10px] shadow-lg transition hover:bg-white disabled:opacity-30 active:scale-95"
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
          <div className="h-16 w-16 border-4 border-slate-800 border-t-white rounded-full animate-spin" />
          <div className="text-center">
            <h3 className="text-lg font-black text-white uppercase tracking-[0.2em]">Importando Lista</h3>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-2">Sincronizando con la base de datos...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-6">
        <div className="rounded-[2.5rem] border-2 border-dashed border-slate-700 bg-slate-900/30 p-12 transition hover:border-white hover:bg-slate-900/50">
          <label className="flex flex-col items-center justify-center cursor-pointer group">
            <input type="file" className="hidden" accept=".csv" onChange={handleFileChange} />
            <div className="h-24 w-24 flex items-center justify-center rounded-[2rem] bg-slate-800 shadow-2xl ring-1 ring-slate-700 transition group-hover:scale-110 group-hover:bg-slate-700">
              <HiCloudUpload className="h-12 w-12 text-white" />
            </div>
            <div className="mt-8 text-center">
              <h3 className="text-xl font-black text-white tracking-tight uppercase">Cargar lista de precios</h3>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-3">Sube tu archivo CSV del proveedor</p>
            </div>
            <div className="mt-10 flex items-center gap-3 rounded-2xl bg-white text-black px-10 py-4 text-[11px] font-black uppercase tracking-widest shadow-xl transition hover:scale-105 active:scale-95">
              <HiTable className="h-5 w-5" />
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

      {!hideHistory && (
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Historial de Importaciones</h3>
          </div>
          <ProveedorImportHistory id_proveedor={id_proveedor} />
        </div>
      )}
    </div>
  );
}
