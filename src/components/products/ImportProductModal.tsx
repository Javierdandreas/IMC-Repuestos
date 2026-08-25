"use client";

import { useState, useMemo } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import { HiCheck, HiCloudUpload, HiExclamation, HiPlay, HiRefresh, HiSparkles } from "react-icons/hi";
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
  autoMatched?: boolean;
  confidence?: "high" | "medium" | "low";
}

type ImportValidationIssue = {
  type: "error" | "warning";
  message: string;
};

const SYSTEM_FIELDS = [
  { id: 'cod_unico', label: 'Código interno', description: 'Identificador único del item', group: 'Datos principales', required: true, aliases: ['codigo', 'codigo unico', 'codigo único', 'codigo interno', 'cod unico', 'cod_unico', 'sku', 'item', 'codigo producto', 'id producto'] },
  { id: 'titulo', label: 'Descripción', description: 'Nombre o título del item', group: 'Datos principales', aliases: ['titulo', 'descripcion', 'descripción', 'nombre', 'producto', 'articulo', 'artículo', 'detalle'] },
  { id: 'cod_barra', label: 'Código de barras', description: 'EAN, barcode o código escaneable', group: 'Datos principales', aliases: ['codigo barra', 'codigo de barras', 'cod barra', 'cod_barra', 'barcode', 'ean', 'gtin'] },
  { id: 'stock', label: 'Stock actual', description: 'Cantidad disponible', group: 'Datos principales', aliases: ['stock', 'cantidad', 'existencia', 'existencias', 'disponible', 'inventario', 'qty'] },
  { id: 'marca', label: 'Marca', description: 'Marca o fabricante', group: 'Clasificación', aliases: ['marca', 'brand', 'fabricante'] },
  { id: 'subcategoria', label: 'Subcategoría', description: 'Rubro/subrubro que existe en el sistema', group: 'Clasificación', aliases: ['subcategoria', 'subcategoría', 'sub categoria', 'sub categoría', 'subrubro', 'rubro', 'familia'] },
  { id: 'ubicacion', label: 'Ubicación', description: 'Ubicación interna inicial', group: 'Clasificación', aliases: ['ubicacion', 'ubicación', 'location', 'deposito', 'depósito', 'almacen', 'almacén', 'pasillo', 'estante', 'rack'] },
  { id: 'codigo_pieza', label: 'Código de item asociado', description: 'Número del item asociado o referencia', group: 'Item asociado y proveedor', aliases: ['codigo pieza', 'codigo de pieza', 'cod pieza', 'nro pieza', 'nro item asociado', 'numero pieza', 'número pieza', 'parte', 'part number', 'numero parte', 'número parte', 'codigo item asociado', 'item asociado'] },
  { id: 'palabra_clave', label: 'Palabras clave', description: 'Texto auxiliar de búsqueda', group: 'Item asociado y proveedor', aliases: ['palabra clave', 'palabras clave', 'keywords', 'keyword', 'clave', 'etiquetas', 'tags'] },
  { id: 'proveedor', label: 'Proveedor', description: 'Proveedor asociado al item', group: 'Item asociado y proveedor', aliases: ['proveedor', 'supplier', 'vendor'] },
  { id: 'codigo_proveedor', label: 'Código proveedor', description: 'Código del item en el proveedor', group: 'Item asociado y proveedor', aliases: ['codigo proveedor', 'codigo en proveedor', 'cod proveedor', 'sku proveedor', 'item proveedor', 'referencia proveedor', 'codigo lista'] },
  { id: 'precio_lista_proveedor', label: 'Precio lista proveedor', description: 'Precio informado por el proveedor', group: 'Item asociado y proveedor', aliases: ['precio lista proveedor', 'precio proveedor', 'lista proveedor', 'precio lista', 'costo proveedor', 'precio de proveedor'] },
];

const normalizeHeader = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const createInitialMappings = (): Record<string, MappingConfig> => {
  const initial: Record<string, MappingConfig> = {};
  SYSTEM_FIELDS.forEach(field => {
    initial[field.id] = {
      csvHeader: '',
      updateExisting: true,
      isRequired: field.required,
    };
  });
  return initial;
};

const scoreHeaderForField = (header: string, field: typeof SYSTEM_FIELDS[number]) => {
  const normalizedHeader = normalizeHeader(header);
  let score = 0;

  if (
    (field.id === 'proveedor' || field.id === 'codigo_proveedor') &&
    normalizedHeader.includes('precio') &&
    normalizedHeader.includes('lista')
  ) {
    return 0;
  }

  field.aliases.forEach(alias => {
    const normalizedAlias = normalizeHeader(alias);
    if (normalizedHeader === normalizedAlias) score = Math.max(score, 100);
    else if (normalizedHeader.includes(normalizedAlias)) score = Math.max(score, 82);
    else if (normalizedAlias.includes(normalizedHeader) && normalizedHeader.length >= 4) score = Math.max(score, 70);
  });

  return score;
};

const autoMapHeaders = (headers: string[]): Record<string, MappingConfig> => {
  const next = createInitialMappings();
  const usedHeaders = new Set<string>();

  SYSTEM_FIELDS.forEach(field => {
    const candidates = headers
      .filter(header => !usedHeaders.has(header))
      .map(header => ({ header, score: scoreHeaderForField(header, field) }))
      .filter(candidate => candidate.score >= 70)
      .sort((a, b) => b.score - a.score);

    const match = candidates[0];
    if (match) {
      usedHeaders.add(match.header);
      next[field.id] = {
        ...next[field.id],
        csvHeader: match.header,
        autoMatched: true,
        confidence: match.score >= 95 ? "high" : match.score >= 82 ? "medium" : "low",
      };
    }
  });

  return next;
};

export function ImportProductModal({ onClose, variant = "modal" }: { onClose: () => void; variant?: "modal" | "page" }) {
  const router = useRouter();
  const isPage = variant === "page";
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [preview, setPreview] = useState<any[]>([]);
  const [mappings, setMappings] = useState<Record<string, MappingConfig>>(createInitialMappings);

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

          setMappings(autoMapHeaders(headers));
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

            setMappings(autoMapHeaders(results.meta.fields));
            setStep('mapping');
          }
        },
      });
    }
  };

  const handleImport = async () => {
    if (!file) return;
    if (blockingImportIssues.length > 0) {
      toast.error("Revisa el mapeo antes de importar");
      return;
    }

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
      [fieldId]: {
        ...prev[fieldId],
        csvHeader: header,
        autoMatched: false,
        confidence: undefined,
      }
    }));
  };

  const mappedCount = useMemo(
    () => SYSTEM_FIELDS.filter(field => Boolean(mappings[field.id]?.csvHeader)).length,
    [mappings]
  );

  const missingRequiredFields = useMemo(
    () => SYSTEM_FIELDS.filter(field => field.required && !mappings[field.id]?.csvHeader),
    [mappings]
  );

  const mappedHeaders = useMemo(
    () => new Set(Object.values(mappings).map(mapping => mapping.csvHeader).filter(Boolean)),
    [mappings]
  );

  const unmappedHeaders = useMemo(
    () => csvHeaders.filter(header => !mappedHeaders.has(header)),
    [csvHeaders, mappedHeaders]
  );

  const importValidationIssues = useMemo<ImportValidationIssue[]>(() => {
    const issues: ImportValidationIssue[] = [];
    const selectedEntries = Object.entries(mappings).filter(([, config]) => Boolean(config.csvHeader));
    const selectedHeaderCounts = new Map<string, string[]>();

    selectedEntries.forEach(([fieldId, config]) => {
      const key = config.csvHeader;
      selectedHeaderCounts.set(key, [...(selectedHeaderCounts.get(key) || []), fieldId]);
    });

    selectedHeaderCounts.forEach((fieldIds, header) => {
      if (fieldIds.length > 1) {
        const labels = fieldIds
          .map((fieldId) => SYSTEM_FIELDS.find((field) => field.id === fieldId)?.label || fieldId)
          .join(", ");
        issues.push({
          type: "error",
          message: `La columna "${header}" esta asignada a varios campos: ${labels}. Elegi una columna distinta para cada dato.`,
        });
      }
    });

    missingRequiredFields.forEach((field) => {
      issues.push({
        type: "error",
        message: `Falta mapear el campo obligatorio "${field.label}".`,
      });
    });

    const providerHeader = mappings.proveedor?.csvHeader;
    const supplierFieldLabels = [
      { fieldId: "codigo_proveedor", label: "Codigo proveedor" },
      { fieldId: "precio_lista_proveedor", label: "Precio lista proveedor" },
    ];

    supplierFieldLabels.forEach(({ fieldId, label }) => {
      if (mappings[fieldId]?.csvHeader && !providerHeader) {
        issues.push({
          type: "error",
          message: `Para importar "${label}" tambien tenes que mapear "Proveedor".`,
        });
      }
    });

    const combinedSupplierColumnFields = ["proveedor", "codigo_proveedor", "precio_lista_proveedor"].filter((fieldId) => {
      const header = mappings[fieldId]?.csvHeader;
      return header && normalizeHeader(header).includes("proveedores y precios lista");
    });

    if (combinedSupplierColumnFields.length > 0) {
      issues.push({
        type: "error",
        message: `No uses la columna combinada "Proveedores y Precios Lista" para importar. Usa las columnas separadas: Proveedor, Codigo Proveedor y Precio Lista Proveedor.`,
      });
    }

    if (providerHeader && !mappings.codigo_proveedor?.csvHeader && !mappings.precio_lista_proveedor?.csvHeader) {
      issues.push({
        type: "warning",
        message: "Se va a vincular el proveedor, pero no se importara codigo proveedor ni precio de lista.",
      });
    }

    return issues;
  }, [mappings, missingRequiredFields]);

  const blockingImportIssues = useMemo(
    () => importValidationIssues.filter((issue) => issue.type === "error"),
    [importValidationIssues]
  );

  const interpretedPreview = useMemo(() => {
    const getValue = (row: any, fieldId: string) => {
      const header = mappings[fieldId]?.csvHeader;
      if (!header) return "-";
      const value = row?.[header];
      if (value === null || value === undefined || String(value).trim() === "") return "-";
      return String(value);
    };

    return preview.slice(0, 6).map((row, index) => ({
      rowNumber: index + 2,
      cod_unico: getValue(row, "cod_unico"),
      descripcion: getValue(row, "titulo"),
      stock: getValue(row, "stock"),
      proveedor: getValue(row, "proveedor"),
      codigo_proveedor: getValue(row, "codigo_proveedor"),
      precio_lista_proveedor: getValue(row, "precio_lista_proveedor"),
    }));
  }, [mappings, preview]);

  const runAutoMapping = () => {
    setMappings(autoMapHeaders(csvHeaders));
  };

  const sampleForHeader = (header: string) => {
    if (!header) return "Sin columna";
    const sample = preview.find(row => {
      const value = row?.[header];
      return value !== undefined && value !== null && String(value).trim() !== "";
    })?.[header];

    if (sample === undefined || sample === null || String(sample).trim() === "") return "Sin ejemplo";
    return String(sample);
  };

  const toggleUpdate = (fieldId: string) => {
    setMappings(prev => ({
      ...prev,
      [fieldId]: { ...prev[fieldId], updateExisting: !prev[fieldId].updateExisting }
    }));
  };

  const renderMappingField = (field: typeof SYSTEM_FIELDS[number]) => {
    const mapping = mappings[field.id];
    const isMapped = Boolean(mapping.csvHeader);
    const isSelected = mapping.updateExisting;
    const sample = sampleForHeader(mapping.csvHeader);

    return (
      <div key={field.id} className="grid grid-cols-1 gap-2 border-b border-slate-200 px-3 py-2 last:border-b-0 dark:border-slate-800 md:grid-cols-[minmax(180px,0.75fr)_minmax(260px,1fr)_minmax(180px,0.85fr)_88px] md:items-center">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-xs font-black text-slate-800 dark:text-slate-100" title={field.label}>
              {field.label}
            </span>
            {field.required && <span className="text-xs font-black text-red-500">*</span>}
            {isMapped && mapping.autoMatched && (
              <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-blue-500 ring-1 ring-blue-500/20">
                Auto
              </span>
            )}
          </div>
          <p className="truncate text-[10px] font-medium text-slate-400 dark:text-slate-500" title={field.description}>
            {field.description}
          </p>
        </div>

        <select
          value={mapping.csvHeader}
          onChange={(e) => updateMapping(field.id, e.target.value)}
          className={`h-10 w-full min-w-0 rounded-lg border px-3 text-xs font-bold outline-none transition focus:ring-2 focus:ring-blue-500/30 ${
            isMapped
              ? 'border-blue-500/50 bg-white text-slate-900 dark:bg-slate-950 dark:text-white'
              : 'border-amber-300 bg-amber-100 text-amber-950 dark:border-amber-500/40 dark:bg-amber-400 dark:text-slate-950'
          }`}
        >
          <option value="">NO IMPORTAR ESTE CAMPO</option>
          {csvHeaders.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>

        <div className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Ejemplo</p>
          <p className="truncate text-xs font-bold text-slate-700 dark:text-slate-200" title={sample}>
            {sample}
          </p>
        </div>

        {field.id !== 'cod_unico' ? (
          <label className="flex h-10 items-center justify-between rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950 md:justify-center" title="Actualizar items existentes">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 md:hidden">Actualiza</span>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleUpdate(field.id)}
              className="sr-only"
            />
            <div className={`relative h-5 w-9 rounded-full transition-colors ${isSelected ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-800'}`}>
              <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${isSelected ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
          </label>
        ) : (
          <div className="flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-[9px] font-black uppercase tracking-widest text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500">
            Identificador
          </div>
        )}
      </div>
    );
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
              <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-500">Auditoría de cambios en items existentes</h4>
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
      <div className="flex flex-col gap-4 animate-in fade-in duration-300">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <HiSparkles className="h-5 w-5 text-blue-500" />
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Mapeo inteligente de columnas</h3>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Revisá qué columna del archivo corresponde a cada campo del sistema antes de importar.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-widest">
              <span className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                {totalRows} filas
              </span>
              <span className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                {csvHeaders.length} columnas
              </span>
              <span className={`rounded-lg border px-3 py-2 ${
                missingRequiredFields.length === 0
                  ? 'border-green-500/20 bg-green-500/10 text-green-500'
                  : 'border-red-500/20 bg-red-500/10 text-red-500'
              }`}>
                {mappedCount}/{SYSTEM_FIELDS.length} mapeados
              </span>
              <button
                type="button"
                onClick={runAutoMapping}
                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-blue-500 transition hover:bg-blue-500/20"
              >
                <HiRefresh className="h-3.5 w-3.5" />
                Detectar otra vez
              </button>
            </div>
          </div>

          {importValidationIssues.length > 0 && (
            <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
              {importValidationIssues.map((issue, index) => (
                <div
                  key={`${issue.type}-${index}`}
                  className={`rounded-xl border px-3 py-2 text-xs font-bold ${
                    issue.type === "error"
                      ? "border-red-500/20 bg-red-500/10 text-red-500"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300"
                  }`}
                >
                  {issue.message}
                </div>
              ))}
            </div>
          )}

          {unmappedHeaders.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="py-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Sin usar:</span>
              {unmappedHeaders.slice(0, 8).map(header => (
                <span key={header} className="rounded-md bg-slate-200 px-2 py-1 text-[10px] font-bold text-slate-600 dark:bg-zinc-800 dark:text-zinc-400">
                  {header}
                </span>
              ))}
              {unmappedHeaders.length > 8 && (
                <span className="rounded-md bg-slate-200 px-2 py-1 text-[10px] font-bold text-slate-600 dark:bg-zinc-800 dark:text-zinc-400">
                  +{unmappedHeaders.length - 8}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
            <div className="hidden grid-cols-[minmax(180px,0.75fr)_minmax(260px,1fr)_minmax(180px,0.85fr)_88px] border-b border-slate-200 bg-slate-100 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 md:grid">
              <span>Campo del sistema</span>
              <span>Columna del archivo</span>
              <span>Dato detectado</span>
              <span className="text-center">Actualiza</span>
            </div>
            {SYSTEM_FIELDS.map(renderMappingField)}
          </div>

          <aside className="flex flex-col gap-3">
            <div className={`rounded-xl border p-4 transition-all ${isReplaceMode ? 'border-red-500/40 bg-red-500/10 text-red-500' : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-900/40'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isReplaceMode ? 'bg-red-500 text-white' : 'bg-slate-200 dark:bg-slate-800'}`}>
                    <HiTrash className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest">Reemplazar lista del proveedor</p>
                    <p className="mt-1 text-[11px] font-medium opacity-75">Borra la lista actual del proveedor antes de importar. Requiere mapear proveedor.</p>
                  </div>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={isReplaceMode}
                    onChange={() => setIsReplaceMode(!isReplaceMode)}
                  />
                  <div className="h-6 w-11 rounded-full bg-slate-200 peer-checked:bg-red-500 peer-focus:outline-none dark:bg-slate-800 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                </label>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Lectura rápida</p>
              <div className="mt-3 space-y-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                <div className="flex items-center justify-between">
                  <span>Campos mapeados</span>
                  <span className="text-blue-500">{mappedCount}/{SYSTEM_FIELDS.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Sin usar</span>
                  <span>{unmappedHeaders.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Archivo</span>
                  <span className="max-w-[170px] truncate text-right" title={file?.name}>{file?.name}</span>
                </div>
              </div>
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                Los campos en amarillo no se importan. El interruptor indica si ese dato actualiza items ya existentes.
              </div>
              <div className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                Los margenes no se importan aca. Se van a manejar desde listas de precio.
              </div>
            </div>
          </aside>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">Vista previa interpretada</h4>
              <p className="mt-1 text-[11px] font-medium text-slate-400">
                Asi se leeran las primeras filas con el mapeo actual.
              </p>
            </div>
            <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:border-slate-800 dark:bg-slate-950">
              {interpretedPreview.length} filas de ejemplo
            </span>
          </div>

          <div className="grid grid-cols-[64px_minmax(120px,0.9fr)_minmax(180px,1.4fr)_80px_minmax(140px,1fr)_minmax(130px,1fr)_minmax(120px,0.8fr)] border-b border-slate-200 bg-slate-100 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-slate-500 dark:border-slate-800 dark:bg-slate-900">
            <span>Fila</span>
            <span>Codigo</span>
            <span>Descripcion</span>
            <span>Stock</span>
            <span>Proveedor</span>
            <span>Codigo prov.</span>
            <span>Precio prov.</span>
          </div>

          <div>
            {interpretedPreview.map((row) => (
              <div key={row.rowNumber} className="grid grid-cols-[64px_minmax(120px,0.9fr)_minmax(180px,1.4fr)_80px_minmax(140px,1fr)_minmax(130px,1fr)_minmax(120px,0.8fr)] border-b border-slate-200 px-3 py-2 text-[11px] font-bold text-slate-700 last:border-b-0 dark:border-slate-800 dark:text-slate-200">
                <span className="text-slate-400">{row.rowNumber}</span>
                <span className="truncate font-mono" title={row.cod_unico}>{row.cod_unico}</span>
                <span className="truncate" title={row.descripcion}>{row.descripcion}</span>
                <span className="truncate" title={row.stock}>{row.stock}</span>
                <span className="truncate" title={row.proveedor}>{row.proveedor}</span>
                <span className="truncate" title={row.codigo_proveedor}>{row.codigo_proveedor}</span>
                <span className="truncate" title={row.precio_lista_proveedor}>{row.precio_lista_proveedor}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={`flex flex-col gap-3 pt-1 sm:flex-row sm:items-center ${isPage ? 'sticky bottom-0 z-10 -mx-1 border-t border-slate-200 bg-white/90 p-3 backdrop-blur dark:border-slate-800 dark:bg-black/90' : ''}`}>
          <button
            onClick={() => setStep('upload')}
            className="h-12 flex-1 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Atrás
          </button>

          {blockingImportIssues.length > 0 && (
            <p className="text-center text-[11px] font-bold text-red-500 sm:max-w-[260px]">
              Corregi los problemas del mapeo antes de importar.
            </p>
          )}

          <button
            onClick={handleImport}
            disabled={blockingImportIssues.length > 0}
            className="flex h-12 flex-[2] items-center justify-center gap-2 rounded-xl bg-blue-600 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <HiPlay className="h-5 w-5" />
            Importar items
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
            <span className="text-3xl font-black text-slate-900 dark:text-white">
              {Math.round((processedCount / (totalRows || 1)) * 100)}%
            </span>
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Status</span>
          </div>
        </div>
        <div className="text-center max-w-sm">
          <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">Procesando {file?.name}</h3>
          <p className="text-sm text-zinc-400 leading-relaxed">Importando registros y actualizando datos mapeados.</p>

          <div className="mt-8 flex flex-col gap-3">
            <div className="flex justify-between text-[11px] font-bold uppercase tracking-widest px-1">
              <span className="text-blue-400">{processedCount}</span>
              <span className="text-zinc-600">DE</span>
              <span className="text-zinc-300">{totalRows} ITEMS</span>
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
    <div className={`grid grid-cols-1 gap-4 ${isPage ? 'xl:grid-cols-[minmax(0,1fr)_360px]' : ''}`}>
      <div className="flex flex-col gap-4">
        <label className={`group relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 transition hover:border-blue-400 hover:bg-blue-50/50 dark:border-slate-800 dark:bg-slate-950 ${isPage ? 'min-h-[360px]' : 'h-40'}`}>
          <input type="file" className="hidden" accept=".csv, .xlsx, .xls" onChange={handleFileChange} />
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-100 transition group-hover:scale-110 group-hover:ring-blue-200 dark:bg-slate-900 dark:ring-slate-800">
            <HiCloudUpload className="h-7 w-7 text-blue-500" />
          </div>
          <span className="text-lg font-black text-slate-900 dark:text-white">Seleccionar CSV o Excel</span>
          <span className="mt-1 text-xs font-medium text-slate-400">Arrastra tu archivo aquí o haz clic para buscar</span>
          <span className="mt-4 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:border-slate-800 dark:bg-slate-900">
            .csv, .xlsx o .xls
          </span>
        </label>

      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex gap-3 rounded-lg border border-amber-100 bg-amber-50 p-3 dark:border-amber-800/40 dark:bg-amber-900/20">
          <HiExclamation className="h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <p className="text-sm font-black leading-tight text-amber-900 dark:text-amber-400">Importación configurable</p>
            <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-500">
              En el siguiente paso vas a confirmar qué columna del archivo se conecta con cada campo del sistema.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {[
            "El código interno identifica si el item se crea o se actualiza.",
            "Proveedor, código proveedor y precio se tratan como campos separados.",
            "Podés decidir qué campos actualizan items existentes."
          ].map((item) => (
            <div key={item} className="flex items-start gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white">
                <HiCheck className="h-3 w-3" />
              </span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
