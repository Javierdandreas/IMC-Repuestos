"use client";

import { useState } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import { HiCloudUpload, HiCheck, HiExclamation, HiX, HiDownload } from "react-icons/hi";
import { useRouter } from "next/navigation";

interface ImportError {
  row: number;
  error: string;
  cod_unico: string;
}

interface ImportResults {
  imported: number;
  ignored: number;
  errors: ImportError[];
}

export function ImportProductModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [results, setResults] = useState<ImportResults | null>(null);
  const [preview, setPreview] = useState<any[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      parseFile(selectedFile);
    }
  };

  const parseFile = (file: File) => {
    setParsing(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setPreview(results.data);
        setParsing(false);
      },
      error: (error) => {
        toast.error(`Error al leer el archivo: ${error.message}`);
        setParsing(false);
      }
    });
  };

  const handleImport = async () => {
    if (!preview.length) return;

    try {
      setImporting(true);
      setProcessedCount(0);
      
      const BATCH_SIZE = 500;
      const totalItems = preview.length;
      let accumulatedResults: ImportResults = {
        imported: 0,
        ignored: 0,
        errors: []
      };

      for (let i = 0; i < totalItems; i += BATCH_SIZE) {
        const chunk = preview.slice(i, i + BATCH_SIZE);
        
        const res = await fetch("/api/productos/import", {
          method: "POST",
          body: JSON.stringify({ 
            items: chunk,
            fileName: file?.name
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || `Error en el lote que empieza en la fila ${i + 1}`);

        // Acumular resultados
        accumulatedResults.imported += data.imported;
        accumulatedResults.ignored += data.ignored;
        accumulatedResults.errors = [...accumulatedResults.errors, ...data.errors];

        setProcessedCount(Math.min(i + BATCH_SIZE, totalItems));
      }

      setResults(accumulatedResults);
      if (accumulatedResults.imported > 0) {
        toast.success(`Importados ${accumulatedResults.imported} productos correctamente`);
        router.refresh();
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const headers = "codigoInterno,marca,titulo,stock,ubicacionInt,codigoProveedor,CodigoBarras,Palabra clave,Proveedor";
    const example = "\nFIL-101,WIX,FILTRO DE ACEITE,10,PASILLO A1,PROV-123,779000111,94572 98457 WX123,REPUESTOS S.A.";
    const blob = new Blob([headers + example], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla_productos_imc.csv";
    a.click();
  };

  if (results) {
    return (
      <div className="flex flex-col gap-6 p-2">
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-2xl bg-green-50 p-4 border border-green-100 dark:bg-green-900/20 dark:border-green-800/50">
            <span className="block text-2xl font-black text-green-600 dark:text-green-400">{results.imported}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-green-600/70">Nuevos</span>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100 dark:bg-slate-800/40 dark:border-slate-700/50">
            <span className="block text-2xl font-black text-slate-600 dark:text-slate-400">{results.ignored}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600/70">Duplicados (Ignorados)</span>
          </div>
          <div className="rounded-2xl bg-red-50 p-4 border border-red-100 dark:bg-red-900/20 dark:border-red-800/50">
            <span className="block text-2xl font-black text-red-600 dark:text-red-400">{results.errors.length}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-red-600/70">Con Errores</span>
          </div>
        </div>

        {results.errors.length > 0 && (
          <div className="max-h-[300px] overflow-y-auto rounded-2xl border border-red-100 bg-red-50/50 p-4 dark:border-red-900/30 dark:bg-red-950/20">
            <h4 className="mb-3 text-[10px] font-black uppercase tracking-widest text-red-600">Detalle de errores</h4>
            <div className="space-y-2">
              {results.errors.map((err, i) => (
                <div key={i} className="flex gap-2 text-xs text-red-700 dark:text-red-400 bg-white/50 dark:bg-black/20 p-2 rounded-lg">
                  <span className="font-bold">Fila {err.row}:</span>
                  <span>{err.error}</span>
                  <span className="ml-auto font-mono opacity-50">[{err.cod_unico}]</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="h-12 w-full rounded-xl bg-slate-900 font-bold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900"
        >
          Finalizar
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {!file ? (
        <div className="flex flex-col gap-4">
          <label className="group relative flex h-48 cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 transition hover:border-blue-400 hover:bg-blue-50/50 dark:border-slate-800 dark:bg-slate-950">
            <input type="file" className="hidden" accept=".csv" onChange={handleFileChange} />
            <HiCloudUpload className="mb-2 h-12 w-12 text-slate-300 transition group-hover:scale-110 group-hover:text-blue-500" />
            <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Seleccionar archivo CSV</span>
            <span className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Drag & Drop disponible</span>
          </label>
          
          <button 
            onClick={downloadTemplate}
            className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-600 hover:underline dark:text-blue-400"
          >
            <HiDownload /> Descargar plantilla ejemplo
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                <HiCheck />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[200px]">{file.name}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{preview.length} filas detectadas</p>
              </div>
            </div>
            <button onClick={() => setFile(null)} className="text-slate-300 hover:text-red-500">
              <HiX className="h-5 w-5" />
            </button>
          </div>

          <div className="max-h-[200px] overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-950">
            <span className="mb-2 block text-[9px] font-black uppercase tracking-widest text-slate-400">Vista previa (Primeros 3 items)</span>
            <div className="space-y-2">
              {preview.slice(0, 3).map((item, i) => (
                <div key={i} className="rounded-lg border border-slate-100 bg-white p-2 text-[10px] dark:border-slate-800 dark:bg-slate-900">
                  <span className="font-black text-slate-700 dark:text-slate-300">
                    {item.codigoInterno || item.cod_unico || "SIN SKU"}
                  </span>
                  <span className="mx-2 opacity-30">|</span>
                  <span className="text-slate-500">
                    {item.titulo || item.descripcion || "Sin descripción"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-amber-50 p-4 border border-amber-100 dark:bg-amber-900/20 dark:border-amber-800/40">
            <div className="flex gap-3">
              <HiExclamation className="h-5 w-5 text-amber-500 shrink-0" />
              <div className="flex flex-col gap-1">
                <p className="text-[11px] font-bold text-amber-800 dark:text-amber-400 leading-tight">
                  Información de la importación:
                </p>
                <ul className="text-[10px] text-amber-700 dark:text-amber-500 list-disc ml-4 space-y-1">
                  <li>Se ignorarán productos con SKU duplicados.</li>
                  <li>Las categorías o subcategorías no encontradas se asignarán a <b>SIN CATEGORIA</b> automáticamente.</li>
                  <li>Las marcas y ubicaciones no encontradas quedarán vacías.</li>
                </ul>
              </div>
            </div>
          </div>

          {importing && (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-slate-500">
                <span>Progreso de importación</span>
                <span>{processedCount} / {preview.length}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div 
                  className="h-full bg-blue-500 transition-all duration-300 ease-out"
                  style={{ width: `${(processedCount / preview.length) * 100}%` }}
                />
              </div>
            </div>
          )}

          <button
            onClick={handleImport}
            disabled={importing || parsing}
            className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-blue-600 font-bold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 disabled:opacity-50"
          >
            {importing ? (
              <>
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white"></div>
                Procesando...
              </>
            ) : (
              <>Procesar Importación</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
