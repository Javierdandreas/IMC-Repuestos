"use client";

import { useState, useMemo } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import { HiCloudUpload, HiCheck, HiExclamation, HiX, HiDownload, HiChevronRight, HiAdjustments, HiPlay } from "react-icons/hi";
import { useRouter } from "next/navigation";
import { useMetadata } from "@/context/MetadataContext";
import { HiTrash } from "react-icons/hi";
import * as XLSX from "xlsx";



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
  updatedDetails?: { cod_unico: string; changes: any }[];
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
  { id: 'precio_lista', label: 'Precio de Lista (Proveedor)' },
  { id: 'precio_venta', label: 'Precio de Venta (Mostrador)' },
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

  const { proveedores } = useMetadata();
  const [isReplaceMode, setIsReplaceMode] = useState(false);

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
            // Código Interno
            if (['codigo', 'código', 'cod', 'cod_producto', 'codigo_producto', 'cod_unico', 'sku', 'item', 'articulo', 'artículo', 'codigointerno'].includes(h)) {
              newMappings.cod_unico.csvHeader = header;
            }
            // Descripción
            if (['titulo', 'descripcion', 'descripción', 'detalle', 'producto', 'nombre', 'nombre_producto'].includes(h)) {
              newMappings.titulo.csvHeader = header;
            }
            // Stock
            if (['stock', 'cantidad', 'existencia', 'disponible', 'disponibilidad'].includes(h)) {
              newMappings.stock.csvHeader = header;
            }
            // Marca
            if (['marca', 'fabricante', 'brand'].includes(h)) {
              newMappings.marca.csvHeader = header;
            }
            // Proveedor
            if (['proveedor', 'vendor', 'supplier'].includes(h)) {
              newMappings.proveedor.csvHeader = header;
            }
            // Código Proveedor
            if (['codigo de proveedor', 'codigo_proveedor', 'cod_proveedor', 'codigo_en_proveedor', 'codigo prov', 'cod prov', 'proveedor_codigo', 'codprov'].includes(h)) {
              newMappings.codigo_proveedor.csvHeader = header;
            }
            // Precio Lista
            if (['precio lista', 'precio_lista', 'preciolista', 'costo', 'costo_unitario', 'precio_unitario', 'precio lista proveedor'].includes(h)) {
              newMappings.precio_lista.csvHeader = header;
            }
            // Precio Venta
            if (['precio', 'precio_mostrador', 'precio_venta', 'lista 1', 'l1', 'venta', 'mostrador'].includes(h)) {
              newMappings.precio_venta.csvHeader = header;
            }
            // Ubicación
            if (['ubicacion', 'pasillo', 'estante', 'ubicación', 'posicion'].includes(h)) {
              newMappings.ubicacion.csvHeader = header;
            }
            // Código de Barras
            if (['codigo_barra', 'cod_barra', 'ean', 'barcode', 'codigo_barras', 'código de barras'].includes(h)) {
              newMappings.cod_barra.csvHeader = header;
            }
            // Palabra Clave
            if (['palabra clave', 'palabras clave', 'keywords', 'keyword', 'tags'].includes(h)) {
              newMappings.palabra_clave.csvHeader = header;
            }
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
              // Código Interno
              if (['codigo', 'código', 'cod', 'cod_producto', 'codigo_producto', 'cod_unico', 'sku', 'item', 'articulo', 'artículo', 'codigointerno'].includes(h)) {
                newMappings.cod_unico.csvHeader = header;
              }
              // Descripción
              if (['titulo', 'descripcion', 'descripción', 'detalle', 'producto', 'nombre', 'nombre_producto'].includes(h)) {
                newMappings.titulo.csvHeader = header;
              }
              // Stock
              if (['stock', 'cantidad', 'existencia', 'disponible', 'disponibilidad'].includes(h)) {
                newMappings.stock.csvHeader = header;
              }
              // Marca
              if (['marca', 'fabricante', 'brand'].includes(h)) {
                newMappings.marca.csvHeader = header;
              }
              // Proveedor
              if (['proveedor', 'vendor', 'supplier'].includes(h)) {
                newMappings.proveedor.csvHeader = header;
              }
              // Código Proveedor
              if (['codigo de proveedor', 'codigo_proveedor', 'cod_proveedor', 'codigo_en_proveedor', 'codigo prov', 'cod prov', 'proveedor_codigo', 'codprov'].includes(h)) {
                newMappings.codigo_proveedor.csvHeader = header;
              }
              // Precio Lista
              if (['precio lista', 'precio_lista', 'preciolista', 'costo', 'costo_unitario', 'precio_unitario', 'precio lista proveedor'].includes(h)) {
                newMappings.precio_lista.csvHeader = header;
              }
              // Precio Venta
              if (['precio', 'precio_mostrador', 'precio_venta', 'lista 1', 'l1', 'venta', 'mostrador'].includes(h)) {
                newMappings.precio_venta.csvHeader = header;
              }
              // Ubicación
              if (['ubicacion', 'pasillo', 'estante', 'ubicación', 'posicion'].includes(h)) {
                newMappings.ubicacion.csvHeader = header;
              }
              // Código de Barras
              if (['codigo_barra', 'cod_barra', 'ean', 'barcode', 'codigo_barras', 'código de barras'].includes(h)) {
                newMappings.cod_barra.csvHeader = header;
              }
              // Palabra Clave
              if (['palabra clave', 'palabras clave', 'keywords', 'keyword', 'tags'].includes(h)) {
                newMappings.palabra_clave.csvHeader = header;
              }
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

        // Lógica de Reemplazo Total
        if (isReplaceMode) {
          const provHeader = mappings.proveedor?.csvHeader;
          if (!provHeader) {
            toast.error("Para usar el modo reemplazo debes mapear la columna 'Proveedor'");
            setImporting(false);
            setStep('mapping');
            return;
          }

          const firstProvName = (allData.data[0] as any)[provHeader]?.toString().trim();
          if (!firstProvName) {
            toast.error("No se detectó el nombre del proveedor en la primera fila");
            setImporting(false);
            setStep('mapping');
            return;
          }

          const prov = proveedores.find(p => p.descripcion.toLowerCase() === firstProvName.toLowerCase());
          if (!prov) {
            toast.error(`Proveedor '${firstProvName}' no encontrado en el sistema`);
            setImporting(false);
            setStep('mapping');
            return;
          }

          const confirmed = window.confirm(`¡ATENCIÓN! Se ELIMINARÁ toda la lista actual de '${prov.descripcion}' para reemplazarla con los ${totalItems} ítems nuevos. ¿Deseas continuar?`);
          if (!confirmed) {
            setImporting(false);
            setStep('mapping');
            return;
          }

          // Ejecutar limpieza
          try {
            const clearRes = await fetch("/api/productos/import/clear-provider", {
              method: "POST",
              body: JSON.stringify({ id_proveedor: prov.id })
            });
            if (!clearRes.ok) throw new Error("Error al limpiar catálogo anterior");
            toast.info(`Catálogo de ${prov.descripcion} limpiado. Iniciando importación...`);
          } catch (err: any) {
            toast.error(err.message);
            setImporting(false);
            setStep('mapping');
            return;
          }
        }

        const BATCH_SIZE = 500;
        let accumulatedResults: ImportResults = {
          imported: 0,
          updated: 0,
          ignored: 0,
          errors: [],
          updatedDetails: []
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
              if (data.updatedDetails) {
                accumulatedResults.updatedDetails = [...(accumulatedResults.updatedDetails || []), ...data.updatedDetails];
              }
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

        {results.updatedDetails && results.updatedDetails.length > 0 && (
          <div className="flex flex-col gap-3 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 max-h-[400px] overflow-hidden">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-500">Auditoría de Cambios en Productos Existentes</h4>
              <span className="text-[9px] font-bold text-blue-400/50 uppercase tracking-tighter">Últimos {Math.min(results.updatedDetails.length, 300)} registros</span>
            </div>
            
            <div className="overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-blue-500/20">
              <div className="flex flex-col gap-2">
                {results.updatedDetails.slice(0, 300).map((item, i) => (
                  <div key={i} className="flex flex-col gap-2 p-3 bg-black/40 rounded-xl border border-blue-500/10 hover:border-blue-500/30 transition-colors">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black text-blue-500/60 uppercase tracking-widest">CÓDIGO:</span>
                        <span className="font-mono text-sm font-black text-blue-400">{item.cod_unico}</span>
                      </div>
                      <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-tighter text-blue-400 border border-blue-500/20">
                        Sincronización Exitosa
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(item.changes).map(([field, value]) => (
                        <div key={field} className="flex items-center gap-1 rounded-lg bg-zinc-900/50 px-2 py-1 border border-white/5">
                          <span className="text-[8px] font-bold uppercase text-zinc-500">{field.replace('id_', '').replace('_', ' ')}:</span>
                          <span className="text-[10px] font-bold text-zinc-300 truncate max-w-[200px]">
                            {value === null || value === undefined ? '—' : String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {results.updatedDetails.length > 300 && (
                  <p className="text-[10px] text-center text-zinc-500 py-4 italic border-t border-white/5 mt-2">
                    Mostrando los primeros 300 cambios para optimizar el rendimiento...
                  </p>
                )}
              </div>
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
      <div className="flex flex-col gap-5 animate-in fade-in duration-300">
        <div className="flex items-center justify-between bg-slate-50 dark:bg-zinc-900/50 rounded-2xl p-4 border border-slate-200 dark:border-zinc-800">
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">Configuración de Columnas</h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400">Mapea los datos de tu CSV a los campos de la base de datos.</p>
          </div>
          <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
            <HiAdjustments className="h-5 w-5" />
          </div>
        </div>

        {/* MODO REEMPLAZO TOTAL */}
        <div className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${isReplaceMode ? 'bg-red-500/10 border-red-500/40 text-red-500' : 'bg-slate-50 dark:bg-zinc-900/50 border-slate-200 dark:border-zinc-800 text-slate-500'}`}>
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 flex items-center justify-center rounded-xl ${isReplaceMode ? 'bg-red-500 text-white' : 'bg-slate-200 dark:bg-zinc-800'}`}>
              <HiTrash className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest">Modo Reemplazo Total</p>
              <p className="text-[10px] opacity-70">Borra la lista actual del proveedor antes de importar la nueva.</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              className="sr-only peer" 
              checked={isReplaceMode}
              onChange={() => setIsReplaceMode(!isReplaceMode)}
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-h-[400px] overflow-y-auto pr-2 px-1 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-zinc-700">
          {SYSTEM_FIELDS.map((field) => {
            const isSelected = mappings[field.id].updateExisting;
            return (
              <div
                key={field.id}
                className={`flex flex-col gap-2 rounded-2xl p-3 border transition-all ${isSelected
                    ? 'bg-blue-50/50 dark:bg-blue-500/5 border-blue-200 dark:border-blue-500/30'
                    : 'bg-slate-50/50 dark:bg-zinc-900/30 border-slate-200 dark:border-zinc-800 opacity-80'
                  }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-black uppercase tracking-widest ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-zinc-400'
                    }`}>
                    {field.label} {field.required && <span className="text-red-500">*</span>}
                  </span>

                  {field.id !== 'cod_unico' && (
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <span className={`text-[8px] font-black tracking-widest transition-colors ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-zinc-600'
                        }`}>
                        {isSelected ? 'SINCRONIZAR' : 'OMITIR'}
                      </span>

                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleUpdate(field.id)}
                        className="sr-only"
                      />

                      <div className={`w-7 h-4 rounded-full transition-colors relative ${isSelected ? 'bg-blue-500' : 'bg-slate-300 dark:bg-zinc-800'
                        }`}>
                        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${isSelected ? 'translate-x-[13px]' : 'translate-x-0.5'
                          }`} />
                      </div>
                    </label>
                  )}
                </div>

                {isSelected && (
                  <select
                    value={mappings[field.id].csvHeader}
                    onChange={(e) => updateMapping(field.id, e.target.value)}
                    className={`h-9 w-full rounded-xl border px-3 text-[11px] font-bold transition focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${mappings[field.id].csvHeader
                        ? 'bg-white dark:bg-zinc-950 border-blue-500/50 text-slate-900 dark:text-white shadow-sm'
                        : 'bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-slate-400'
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
            );
          })}
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={() => setStep('upload')}
            className="h-12 flex-1 rounded-2xl bg-white dark:bg-zinc-800 font-bold text-slate-600 dark:text-zinc-300 transition hover:bg-slate-50 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700 text-xs"
          >
            Atrás
          </button>

          <button
            onClick={handleImport}
            disabled={!mappings.cod_unico.csvHeader}
            className="h-12 flex-[2] flex items-center justify-center gap-2 rounded-2xl bg-blue-600 font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 disabled:opacity-50 text-xs uppercase tracking-widest"
          >
            <HiPlay className="h-5 w-5" />
            Importar CSV
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
          <input type="file" className="hidden" accept=".csv, .xlsx, .xls" onChange={handleFileChange} />
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-100 transition group-hover:scale-110 group-hover:ring-blue-200 dark:bg-slate-900 dark:ring-slate-800">
            <HiCloudUpload className="h-8 w-8 text-blue-500" />
          </div>
          <span className="text-base font-black text-slate-900 dark:text-white">Seleccionar CSV o Excel</span>
          <span className="mt-1 text-xs font-medium text-slate-400">Arrastra tu archivo aquí o haz clic para buscar</span>
        </label>

      </div>

      <div className="rounded-2xl bg-amber-50 p-4 border border-amber-100 dark:bg-amber-900/20 dark:border-amber-800/40">
        <div className="flex gap-3">
          <HiExclamation className="h-5 w-5 text-amber-500 shrink-0" />
          <div>
            <p className="text-sm font-black text-amber-900 dark:text-amber-400 leading-tight uppercase tracking-tight">Personalización de importación:</p>
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-500 font-medium">
              En el siguiente paso podrás elegir exactamente qué columnas de tu Excel corresponden a cada campo del sistema y decidir si quieres actualizar los productos existentes o solo añadir los nuevos.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
