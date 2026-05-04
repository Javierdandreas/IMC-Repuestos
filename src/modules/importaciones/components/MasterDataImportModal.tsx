"use client";

import { useState } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import { HiCloudUpload, HiCheck, HiX, HiPlay } from "react-icons/hi";

interface Props {
  onClose: () => void;
  onSuccess: () => void;
  table: string;
  title: string;
}

export function MasterDataImportModal({ onClose, onSuccess, table, title }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [step, setStep] = useState<'upload' | 'mapping' | 'confirm'>('upload');
  const [items, setItems] = useState<any[]>([]);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [selectedColumn, setSelectedColumn] = useState<string>('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      parseFile(selectedFile);
    }
  };

  const parseFile = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        // Buscamos una columna que se parezca a descripcion o nombre
        const data = results.data as any[];
        if (data.length === 0) {
          toast.error("El archivo está vacío");
          return;
        }

        const headers = Object.keys(data[0]);
        const normalizeStr = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

        let singularEntity = table.toLowerCase();
        if (table === 'ubicaciones') singularEntity = 'ubicacion';
        if (table === 'categorias') singularEntity = 'categoria';
        if (table === 'subcategorias') singularEntity = 'subcategoria';
        if (table === 'proveedores') singularEntity = 'proveedor';
        if (table === 'marcas') singularEntity = 'marca';

        const entityPriorityNames = [singularEntity, table.toLowerCase()];
        const fallbackNames = ['descripcion', 'nombre', 'name', 'description', 'titulo', 'detalle'];

        let descHeader = headers.find(h => entityPriorityNames.includes(normalizeStr(h)));
        if (!descHeader) {
          descHeader = headers.find(h => fallbackNames.includes(normalizeStr(h)));
        }

        setParsedData(data);
        setCsvHeaders(headers);
        if (descHeader) {
          setSelectedColumn(descHeader);
        } else if (headers.length > 0) {
          setSelectedColumn(headers[0]);
        }

        setStep('mapping');
      }
    });
  };

  const handleConfirmMapping = () => {
    if (!selectedColumn) {
      toast.error("Debes seleccionar una columna");
      return;
    }
    
    // Usamos un Set para obtener solo valores únicos y evitar procesar duplicados innecesariamente
    const uniqueValues = new Set<string>();
    const normalizedItems: any[] = [];
    
    for (const row of parsedData) {
      const val = row[selectedColumn];
      if (val) {
        const strVal = String(val).trim();
        if (strVal && !uniqueValues.has(strVal.toLowerCase())) {
          uniqueValues.add(strVal.toLowerCase());
          normalizedItems.push({ descripcion: strVal });
        }
      }
    }

    if (normalizedItems.length === 0) {
      toast.error("No se encontraron registros válidos en la columna seleccionada");
      return;
    }

    setItems(normalizedItems);
    setStep('confirm');
  };

  const handleImport = async () => {
    try {
      setImporting(true);
      const res = await fetch("/api/catalogos/import", {
        method: "POST",
        body: JSON.stringify({ table, items })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Error al importar");

      toast.success(`Importación finalizada: ${data.insertedCount} creados, ${data.ignoredCount} ya existían.`);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-2">
      {step === 'upload' ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            Sube un archivo CSV con una columna llamada <span className="font-bold text-blue-500">&quot;{table === 'ubicaciones' ? 'ubicacion' : table === 'categorias' ? 'categoria' : table === 'subcategorias' ? 'subcategoria' : table === 'proveedores' ? 'proveedor' : table === 'marcas' ? 'marca' : 'descripcion'}&quot;</span>, <span className="font-bold text-blue-500">&quot;descripcion&quot;</span> o <span className="font-bold text-blue-500">&quot;nombre&quot;</span> para importar {title.toLowerCase()} masivamente.
          </p>
          
          <label className="flex h-48 w-full cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/50 transition hover:border-blue-500 hover:bg-blue-50/50 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-blue-500/50 dark:hover:bg-blue-500/5">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <div className="mb-4 rounded-full bg-blue-100 p-4 dark:bg-blue-500/10">
                <HiCloudUpload className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="mb-2 text-sm font-bold text-slate-700 dark:text-zinc-200">
                Haga clic para cargar o arrastre y suelte
              </p>
              <p className="text-xs text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-widest">
                CSV (MAX. 5MB)
              </p>
            </div>
            <input type="file" className="hidden" accept=".csv" onChange={handleFileChange} />
          </label>
        </div>
      ) : step === 'mapping' ? (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between bg-slate-50 dark:bg-zinc-900/50 rounded-2xl p-4 border border-slate-200 dark:border-zinc-800">
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Selecciona la columna</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">¿Qué columna del CSV quieres usar para {title.toLowerCase()}?</p>
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-2xl p-4 border bg-blue-50/50 dark:bg-blue-500/5 border-blue-200 dark:border-blue-500/30">
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">
              Columna a importar
            </span>
            <select
              value={selectedColumn}
              onChange={(e) => setSelectedColumn(e.target.value)}
              className="h-11 w-full rounded-xl border border-blue-500/50 bg-white dark:bg-zinc-950 px-3 text-sm font-bold text-slate-900 dark:text-white shadow-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            >
              <option value="" disabled>-- Selecciona una columna --</option>
              {csvHeaders.map(h => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep('upload')}
              className="h-12 flex-1 rounded-2xl bg-white dark:bg-zinc-800 font-bold text-slate-600 dark:text-zinc-300 transition hover:bg-slate-50 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700 text-xs uppercase tracking-widest"
            >
              Atrás
            </button>
            <button
              onClick={handleConfirmMapping}
              disabled={!selectedColumn}
              className="h-12 flex-[2] flex items-center justify-center gap-2 rounded-2xl bg-blue-600 font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 disabled:opacity-50 text-xs uppercase tracking-widest"
            >
              Continuar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="rounded-2xl bg-blue-500/10 p-6 border border-blue-500/20">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-black text-xl">
                {items.length}
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Registros detectados</h4>
                <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Se importarán en la tabla <span className="font-bold text-blue-500">{table}</span>.</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep('upload')}
              className="h-12 flex-1 rounded-2xl bg-white dark:bg-zinc-800 font-bold text-slate-600 dark:text-zinc-300 transition hover:bg-slate-50 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700 text-xs uppercase tracking-widest"
            >
              Cambiar Archivo
            </button>
            <button
              onClick={handleImport}
              disabled={importing}
              className="h-12 flex-[2] flex items-center justify-center gap-2 rounded-2xl bg-blue-600 font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 disabled:opacity-50 text-xs uppercase tracking-widest"
            >
              {importing ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              ) : (
                <HiPlay className="h-5 w-5" />
              )}
              Confirmar Importación
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
