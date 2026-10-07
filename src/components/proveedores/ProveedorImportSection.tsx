"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { HiCheck, HiChevronLeft, HiChevronRight, HiCloudUpload, HiDownload, HiExclamation, HiPlay, HiSave, HiTable } from "react-icons/hi";
import useSWR, { mutate } from "swr";

import { ProveedorImportHistory } from "./ProveedorImportHistory";
import { TransferProgressModal } from "@/components/ui/TransferProgressModal";
import {
  labelEstadoStockProveedor,
  normalizarStockProveedor,
  normalizarStockProveedorPorColor,
  type EstadoStockProveedor,
} from "@/lib/stock-proveedor";

type Step = "upload" | "mapping" | "importing" | "results";

interface ImportResults {
  idImportacion: number;
  total: number;
  updatedCount: number;
  recalculatedCostCount: number;
  pendingApprovalCount: number;
  notFoundCount: number;
  invalidCount: number;
  duplicateCount: number;
  providerMismatchCount: number;
}

interface MappingConfig {
  csvHeader: string;
  isRequired?: boolean;
}

type StockColorRule = {
  color: string;
  estado: EstadoStockProveedor;
  activo: boolean;
};

const STOCK_COLOR_ROW = "__COLOR_FILA_EXCEL__";
const PREVIEW_PAGE_SIZE = 50;

async function requestImportJson(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  const payload = await response.clone().json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok) {
    if (response.status === 413) throw new Error("El lote supera el tamaño permitido. Volve a intentar la importacion.");
    const message = typeof payload?.message === "string"
      ? payload.message
      : typeof payload?.error === "string"
        ? payload.error
        : "El servidor no pudo procesar el lote";
    throw new Error(message);
  }
  return payload ?? {};
}

const stockColorRulesFetcher = (url: string) => fetch(url).then(async (response) => {
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "No se pudieron cargar los colores");
  return data;
});

function colorKey(value: unknown) {
  const color = String(value ?? "").replace("#", "").trim().toUpperCase();
  if (color === "SIN_COLOR") return "";
  return color.length >= 6 ? color.slice(-6) : color;
}

function colorLabel(value: string) {
  const color = colorKey(value);
  return color ? `#${color}` : "Sin relleno";
}

function colorStorageKey(value: string) {
  return colorKey(value) || "SIN_COLOR";
}

interface Props {
  id_proveedor: number;
  nombre_proveedor: string;
  onSuccess?: () => void;
  hideHistory?: boolean;
  compact?: boolean;
}

const SUPPLIER_FIELDS = [
  { id: "proveedor", label: "Proveedor", required: false },
  { id: "codigo_proveedor", label: "Codigo proveedor", required: true },
  { id: "precio_lista", label: "Precio de lista", required: true },
  { id: "stock_proveedor", label: "Stock proveedor", required: false },
];

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function detectHeader(headers: string[], fieldId: string) {
  const candidates = fieldId === "proveedor"
    ? [
        { terms: ["proveedor"], score: 100 },
        { terms: ["razon social"], score: 95 },
        { terms: ["empresa"], score: 90 },
        { terms: ["nombre proveedor"], score: 90 },
        { terms: ["cuit"], score: 80 },
        { terms: ["dni"], score: 75 },
      ]
    : fieldId === "codigo_proveedor"
    ? [
        { terms: ["codigo proveedor"], score: 100 },
        { terms: ["cod proveedor"], score: 95 },
        { terms: ["codigo prov"], score: 90 },
        { terms: ["cod prov"], score: 85 },
        { terms: ["sku"], score: 65 },
        { terms: ["referencia"], score: 60 },
        { terms: ["ref"], score: 55 },
        { terms: ["codigo"], score: 45 },
      ]
    : fieldId === "stock_proveedor"
    ? [
        { terms: ["stock proveedor"], score: 100 },
        { terms: ["stock"], score: 95 },
        { terms: ["disponibilidad"], score: 90 },
        { terms: ["disponible"], score: 85 },
        { terms: ["existencia"], score: 80 },
        { terms: ["cantidad"], score: 75 },
      ]
    : [
        { terms: ["precio lista"], score: 100 },
        { terms: ["precio proveedor"], score: 95 },
        { terms: ["lista"], score: 85 },
        { terms: ["precio compra"], score: 75 },
        { terms: ["costo"], score: 65 },
        { terms: ["precio"], score: 55 },
      ];

  const best = headers
    .map((header) => {
      const normalized = normalizeHeader(header);
      const match = candidates.find((candidate) => candidate.terms.some((term) => normalized.includes(term)));
      return { header, score: match?.score ?? 0 };
    })
    .sort((a, b) => b.score - a.score)[0];

  return best?.score ? best.header : "";
}

function parseSupplierPrice(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  let clean = raw.replace(/[^0-9,.-]/g, "");
  if (!clean || clean === "-" || clean === "," || clean === ".") return null;

  const lastComma = clean.lastIndexOf(",");
  const lastDot = clean.lastIndexOf(".");

  if (lastComma >= 0 && lastDot >= 0) {
    clean = lastComma > lastDot
      ? clean.replace(/\./g, "").replace(",", ".")
      : clean.replace(/,/g, "");
  } else if (lastComma >= 0) {
    clean = clean.replace(",", ".");
  }

  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildMappedRows(
  rows: any[],
  mappings: Record<string, MappingConfig>,
  nombreProveedor: string,
  stockColorRules: StockColorRule[],
  previewLimit = 6,
) {
  const supplierHeader = mappings.proveedor?.csvHeader;
  const codeHeader = mappings.codigo_proveedor?.csvHeader;
  const priceHeader = mappings.precio_lista?.csvHeader;
  const stockHeader = mappings.stock_proveedor?.csvHeader;
  const stockFromColor = stockHeader === STOCK_COLOR_ROW;
  const preview: Array<{ row: number; proveedor: string; codigo: string; precio: number | null; stock: string; status: "OK" | "ERROR"; reason: string }> = [];
  const items: Array<{
    fila: number;
    proveedor_archivo: string;
    codigo_proveedor: string;
    precio_lista: number | null;
    precio_original: string;
    stock_original: string;
    stock_fuente: "VALOR" | "COLOR_FILA";
    stock_color: string | null;
    stock_color_estado: EstadoStockProveedor | null;
  }> = [];
  let invalidCount = 0;

  if (!codeHeader || !priceHeader) {
    return { preview, items, invalidCount: rows.length };
  }

  rows.forEach((row, index) => {
    const proveedor = supplierHeader ? String(row?.[supplierHeader] ?? "").trim() : nombreProveedor;
    const codigo = String(row?.[codeHeader] ?? "").trim().toUpperCase();
    const precioOriginal = String(row?.[priceHeader] ?? "").trim();
    const precio = parseSupplierPrice(row?.[priceHeader]);
    const stockColor = stockFromColor ? String(row?.__rowColor ?? "").trim() : "";
    const stockColorRule = stockFromColor
      ? stockColorRules.find((rule) => colorKey(rule.color) === colorKey(stockColor))
      : undefined;
    const stockOriginal = stockFromColor
      ? stockColor
      : stockHeader
        ? String(row?.[stockHeader] ?? "").trim()
        : "";
    const stock = stockFromColor
      ? normalizarStockProveedorPorColor(
        stockColor,
        stockColorRule?.activo === false ? "DESCONOCIDO" : stockColorRule?.estado,
      )
      : normalizarStockProveedor(stockOriginal);
    let reason = "";

    if (!proveedor) reason = "Sin proveedor";
    if (!codigo) reason = "Sin codigo";
    if (precio === null) reason = reason ? `${reason} y sin precio` : "Sin precio";
    if (precio !== null && precio < 0) reason = reason ? `${reason} y precio negativo` : "Precio negativo";

    if (reason) {
      invalidCount += 1;
    }

    items.push({
      fila: Number(row?.__rowNumber) || index + 2,
      proveedor_archivo: proveedor,
      codigo_proveedor: codigo,
      precio_lista: precio,
      precio_original: precioOriginal,
      stock_original: stock.original,
      stock_fuente: stockFromColor ? "COLOR_FILA" : "VALOR",
      stock_color: stockFromColor ? stockColor || null : null,
      stock_color_estado: stockFromColor
        ? stockColorRule?.activo === false ? "DESCONOCIDO" : stockColorRule?.estado ?? null
        : null,
    });

    if (preview.length < previewLimit) {
      preview.push({
        row: Number(row?.__rowNumber) || index + 2,
        proveedor,
        codigo,
        precio,
        stock: labelEstadoStockProveedor(stock.estado, stock.cantidad),
        status: reason ? "ERROR" : "OK",
        reason: reason || "Lista para validar",
      });
    }
  });

  return { preview, items, invalidCount };
}

function createInitialMappings(): Record<string, MappingConfig> {
  const initial: Record<string, MappingConfig> = {};
  SUPPLIER_FIELDS.forEach((field) => {
    initial[field.id] = { csvHeader: "", isRequired: field.required };
  });
  return initial;
}

export function ProveedorImportSection({ id_proveedor, nombre_proveedor, onSuccess, hideHistory, compact }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [isExcelFile, setIsExcelFile] = useState(false);
  const [previewPage, setPreviewPage] = useState(1);
  const [stockColorRules, setStockColorRules] = useState<StockColorRule[]>([]);
  const [savingStockColorRules, setSavingStockColorRules] = useState(false);
  const [excelSheets, setExcelSheets] = useState<string[]>([]);
  const [selectedExcelSheet, setSelectedExcelSheet] = useState("");
  const workbookRef = useRef<XLSX.WorkBook | null>(null);
  const [mappings, setMappings] = useState<Record<string, MappingConfig>>(() => createInitialMappings());
  const [importing, setImporting] = useState(false);
  const [processedRows, setProcessedRows] = useState(0);
  const [importPhase, setImportPhase] = useState<"uploading" | "validating" | "applying">("uploading");
  const [applicationTotal, setApplicationTotal] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [estimatedRemainingMs, setEstimatedRemainingMs] = useState<number | null>(null);
  const importStartedAtRef = useRef<number | null>(null);
  const [results, setResults] = useState<ImportResults | null>(null);
  const { data: savedStockColorRules = [] } = useSWR<StockColorRule[]>(
    `/api/proveedores/${id_proveedor}/stock-colores`,
    stockColorRulesFetcher,
  );

  const mappedData = useMemo(
    () => buildMappedRows(rawRows, mappings, nombre_proveedor, stockColorRules),
    [rawRows, mappings, nombre_proveedor, stockColorRules]
  );
  const previewTotalPages = Math.max(1, Math.ceil(rawRows.length / PREVIEW_PAGE_SIZE));
  const mappedPreviewPage = useMemo(() => buildMappedRows(
    rawRows.slice((previewPage - 1) * PREVIEW_PAGE_SIZE, previewPage * PREVIEW_PAGE_SIZE),
    mappings,
    nombre_proveedor,
    stockColorRules,
    PREVIEW_PAGE_SIZE,
  ).preview, [rawRows, previewPage, mappings, nombre_proveedor, stockColorRules]);
  const canImport = Boolean(mappings.codigo_proveedor.csvHeader && mappings.precio_lista.csvHeader && mappedData.items.length > 0);

  useEffect(() => {
    if (stockColorRules.length === 0 || savedStockColorRules.length === 0) return;
    setStockColorRules((previous) => previous.map((rule) => {
      const savedRule = savedStockColorRules.find((saved) => colorStorageKey(saved.color) === colorStorageKey(rule.color));
      return savedRule ? { ...savedRule, color: rule.color } : rule;
    }));
  }, [savedStockColorRules]);

  useEffect(() => {
    if (!importing) return;
    const timer = window.setInterval(() => {
      if (importStartedAtRef.current !== null) setElapsedMs(Date.now() - importStartedAtRef.current);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [importing]);

  const applyHeadersAndRows = (headers: string[], rows: any[], fromExcel: boolean) => {
    setCsvHeaders(headers);
    setRawRows(rows);
    setPreviewPage(1);
    setIsExcelFile(fromExcel);
    const detectedColors = fromExcel
      ? Array.from(new Set(rows.map((row) => String(row?.__rowColor ?? "").trim())))
      : [];
    setStockColorRules(detectedColors.map((color) => {
      const savedRule = savedStockColorRules.find((rule) => colorStorageKey(rule.color) === colorStorageKey(color));
      return savedRule
        ? { ...savedRule, color }
        : { color, estado: normalizarStockProveedorPorColor(color).estado, activo: true };
    }));
    setResults(null);
    setMappings({
      proveedor: { csvHeader: detectHeader(headers, "proveedor"), isRequired: false },
      codigo_proveedor: { csvHeader: detectHeader(headers, "codigo_proveedor"), isRequired: true },
      precio_lista: { csvHeader: detectHeader(headers, "precio_lista"), isRequired: true },
      stock_proveedor: { csvHeader: detectHeader(headers, "stock_proveedor"), isRequired: false },
    });
    setStep("mapping");
  };

  const loadExcelSheet = (workbook: XLSX.WorkBook, sheetName: string) => {
    try {
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) throw new Error("Hoja no encontrada");

      const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
      const headerColumns: Array<{ header: string; column: number }> = [];
      for (let column = range.s.c; column <= range.e.c; column += 1) {
        const cell = worksheet[XLSX.utils.encode_cell({ r: range.s.r, c: column })];
        const header = String(cell?.v ?? "").trim();
        if (header) headerColumns.push({ header, column });
      }

      const rows: Array<Record<string, unknown>> = [];
      for (let rowIndex = range.s.r + 1; rowIndex <= range.e.r; rowIndex += 1) {
        const row: Record<string, unknown> = { __rowNumber: rowIndex + 1 };
        let hasContent = false;
        let rowColor = "";

        headerColumns.forEach(({ header, column }) => {
          const cell = worksheet[XLSX.utils.encode_cell({ r: rowIndex, c: column })];
          const value = cell?.v ?? "";
          row[header] = value;
          if (value !== "" && value !== null && value !== undefined) hasContent = true;

          const color = cell?.s?.fgColor?.rgb;
          if (!rowColor && color) rowColor = String(color);
        });

        if (hasContent) {
          row.__rowColor = rowColor;
          rows.push(row);
        }
      }

      setSelectedExcelSheet(sheetName);
      applyHeadersAndRows(headerColumns.map(({ header }) => header), rows, true);
    } catch {
      toast.error("Error al leer la hoja de Excel");
    }
  };

  const parseFileHeaders = (selectedFile: File) => {
    const isExcel = selectedFile.name.endsWith(".xlsx") || selectedFile.name.endsWith(".xls");

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const workbook = XLSX.read(event.target?.result, { type: "array", cellStyles: true });
          const firstSheet = workbook.SheetNames[0];
          if (!firstSheet) throw new Error("El archivo no tiene hojas");
          workbookRef.current = workbook;
          setExcelSheets(workbook.SheetNames);
          loadExcelSheet(workbook, firstSheet);
        } catch {
          toast.error("Error al leer el archivo Excel");
        }
      };
      reader.readAsArrayBuffer(selectedFile);
      return;
    }

    workbookRef.current = null;
    setExcelSheets([]);
    setSelectedExcelSheet("");
    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (parseResult) => {
        if (!parseResult.meta.fields?.length) {
          toast.error("No se detectaron columnas en el archivo");
          return;
        }
        applyHeadersAndRows(parseResult.meta.fields, parseResult.data as any[], false);
      },
      error: () => toast.error("Error al leer el archivo CSV"),
    });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    parseFileHeaders(selectedFile);
  };

  const handleExcelSheetChange = (sheetName: string) => {
    if (workbookRef.current) loadExcelSheet(workbookRef.current, sheetName);
  };

  const updateMapping = (fieldId: string, header: string) => {
    setPreviewPage(1);
    setMappings((prev) => ({
      ...prev,
      [fieldId]: { ...prev[fieldId], csvHeader: header },
    }));
  };

  const updateStockColorRule = (color: string, patch: Partial<StockColorRule>) => {
    setStockColorRules((prev) => prev.map((rule) => (
      colorKey(rule.color) === colorKey(color) ? { ...rule, ...patch } : rule
    )));
  };

  const saveStockColorRules = async () => {
    if (stockColorRules.length === 0) return;

    setSavingStockColorRules(true);
    try {
      const response = await fetch(`/api/proveedores/${id_proveedor}/stock-colores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reglas: stockColorRules.map((rule) => ({
            color: colorStorageKey(rule.color),
            estado: rule.estado,
            activo: rule.activo,
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No se pudieron guardar los colores");

      mutate(`/api/proveedores/${id_proveedor}/stock-colores`, data.reglas || [], false);
      toast.success("Colores de stock guardados para este proveedor");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron guardar los colores");
    } finally {
      setSavingStockColorRules(false);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    if (!mappings.codigo_proveedor.csvHeader || !mappings.precio_lista.csvHeader) {
      toast.error("Selecciona las columnas de codigo y precio antes de importar");
      return;
    }
    if (mappedData.items.length === 0) {
      toast.error("No hay filas para importar");
      return;
    }

    try {
      setStep("importing");
      setImporting(true);
      setProcessedRows(0);
      setImportPhase("uploading");
      setApplicationTotal(0);
      setElapsedMs(0);
      setEstimatedRemainingMs(null);
      const startTime = Date.now();
      importStartedAtRef.current = startTime;

      const importacion = await requestImportJson("/api/proveedores/importar/iniciar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_proveedor,
          nombre_archivo: file.name,
          total_items: mappedData.items.length,
        }),
      });
      const idImportacion = Number(importacion.id);
      if (!Number.isInteger(idImportacion) || idImportacion <= 0) {
        throw new Error("No se pudo iniciar la importacion");
      }

      const batchSize = 1000;
      for (let index = 0; index < mappedData.items.length; index += batchSize) {
        const batch = mappedData.items.slice(index, index + batchSize);
        await requestImportJson("/api/proveedores/importar/lote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id_importacion: idImportacion,
            id_proveedor,
            items: batch,
          }),
        });

        const completed = Math.min(index + batch.length, mappedData.items.length);
        const elapsed = Date.now() - startTime;
        setProcessedRows(completed);
        setElapsedMs(elapsed);
        setEstimatedRemainingMs(completed > 0
          ? Math.round((elapsed / completed) * (mappedData.items.length - completed))
          : null);
      }

      await requestImportJson("/api/proveedores/importar/finalizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_importacion: idImportacion, id_proveedor }),
      });

      setImportPhase("validating");
      setProcessedRows(0);
      setEstimatedRemainingMs(null);
      let data: Record<string, unknown> = {};
      do {
        data = await requestImportJson(`/api/proveedores/importaciones/${idImportacion}/aplicar`, {
          method: "POST",
        });
        const total = Number(data.totalProcessable || 0);
        const processed = Number(data.processedCount || 0);
        if (total > 0) setApplicationTotal(total);
        setProcessedRows(processed);
        setImportPhase("applying");
      } while (!data.complete);

      const updatedCount = Number(data.updatedCount || 0);
      const recalculatedCostCount = Number(data.recalculatedCostCount || 0);
      const pendingApprovalCount = Number(data.pendingApprovalCount || 0);
      const notFoundCount = Number(data.notFoundCount || 0);
      const invalidCount = Number(data.invalidCount || 0);
      const duplicateCount = Number(data.duplicateCount || 0);
      const providerMismatchCount = Number(data.providerMismatchCount || 0);

      setResults({
        idImportacion,
        total: mappedData.items.length,
        updatedCount,
        recalculatedCostCount,
        pendingApprovalCount,
        notFoundCount,
        invalidCount,
        duplicateCount,
        providerMismatchCount,
      });
      toast.success(
        pendingApprovalCount > 0
          ? `Lista aplicada. ${pendingApprovalCount} cambio(s) de costo esperan aprobacion.`
          : recalculatedCostCount > 0
            ? `Lista aplicada. ${updatedCount} precios y ${recalculatedCostCount} costos recalculados.`
            : `Lista aplicada. ${updatedCount} precios actualizados.`
      );
      setStep("results");
      onSuccess?.();
      mutate(`/api/proveedores/importaciones?id_proveedor=${id_proveedor}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al importar");
      setStep("mapping");
    } finally {
      setImporting(false);
      importStartedAtRef.current = null;
    }
  };

  const renderStats = () => (
    <div className="grid grid-cols-3 gap-2">
      <div className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2">
        <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">Filas</div>
        <div className="text-sm font-black text-white">{rawRows.length}</div>
      </div>
      <div className="rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-2">
        <div className="text-[9px] font-black uppercase tracking-widest text-green-400">A validar</div>
        <div className="text-sm font-black text-green-300">{mappedData.items.length}</div>
      </div>
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2">
        <div className="text-[9px] font-black uppercase tracking-widest text-amber-400">Con aviso</div>
        <div className="text-sm font-black text-amber-300">{mappedData.invalidCount}</div>
      </div>
    </div>
  );

  const renderPreview = () => (
    <div className="overflow-hidden rounded-xl border border-slate-800">
      <div className="grid grid-cols-[44px_minmax(86px,1fr)_minmax(82px,0.9fr)_88px_90px_90px] gap-2 bg-slate-950/60 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
        <span>Fila</span>
        <span>Proveedor</span>
        <span>Codigo</span>
        <span>Precio</span>
        <span>Stock</span>
        <span>Estado</span>
      </div>
      {mappedPreviewPage.length === 0 ? (
        <div className="px-3 py-3 text-xs font-bold text-slate-500">Selecciona columnas para ver una vista previa.</div>
      ) : (
        <div className="max-h-[420px] divide-y divide-slate-800 overflow-y-auto">
          {mappedPreviewPage.map((row) => (
            <div key={row.row} className="grid grid-cols-[44px_minmax(86px,1fr)_minmax(82px,0.9fr)_88px_90px_90px] items-center gap-2 px-3 py-2 text-xs">
              <span className="font-mono font-bold text-slate-500">{row.row}</span>
              <span className="truncate font-bold text-slate-300">{row.proveedor || "-"}</span>
              <span className="truncate font-black text-white">{row.codigo || "-"}</span>
              <span className="font-mono font-black text-blue-300">{row.precio === null ? "-" : row.precio}</span>
              <span className="truncate font-bold text-slate-400">{row.stock}</span>
              <span className={row.status === "OK" ? "font-black text-green-300" : "font-black text-amber-300"}>
                {row.reason}
              </span>
            </div>
          ))}
        </div>
      )}
      {mappedData.items.length > 0 && (
        <div className="flex items-center justify-between gap-3 border-t border-slate-800 bg-slate-950/40 px-3 py-2.5">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Filas {((previewPage - 1) * PREVIEW_PAGE_SIZE) + 1}-{Math.min(previewPage * PREVIEW_PAGE_SIZE, mappedData.items.length)} de {mappedData.items.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPreviewPage((page) => Math.max(1, page - 1))}
              disabled={previewPage <= 1}
              title="Pagina anterior"
              aria-label="Pagina anterior"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 text-slate-300 transition hover:border-blue-500 hover:text-blue-300 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <HiChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-20 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
              Pag. {previewPage} de {previewTotalPages}
            </span>
            <button
              type="button"
              onClick={() => setPreviewPage((page) => Math.min(previewTotalPages, page + 1))}
              disabled={previewPage >= previewTotalPages}
              title="Pagina siguiente"
              aria-label="Pagina siguiente"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 text-slate-300 transition hover:border-blue-500 hover:text-blue-300 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <HiChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderMapping = () => (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-xs font-black text-white">{file?.name}</div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{nombre_proveedor}</div>
        </div>
        <label className="inline-flex h-9 cursor-pointer items-center justify-center rounded-lg border border-slate-700 px-3 text-[10px] font-black uppercase tracking-widest text-slate-300 transition hover:bg-slate-900">
          <input type="file" className="hidden" accept=".csv,.xlsx,.xls" onChange={handleFileChange} />
          Cambiar archivo
        </label>
      </div>

      {isExcelFile && excelSheets.length > 1 ? (
        <div className="max-w-sm space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-blue-400">Hoja de Excel</label>
          <select
            value={selectedExcelSheet}
            onChange={(event) => handleExcelSheetChange(event.target.value)}
            className="h-10 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 text-xs font-black text-white outline-none transition focus:border-blue-500"
          >
            {excelSheets.map((sheet) => <option key={sheet} value={sheet}>{sheet}</option>)}
          </select>
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        {SUPPLIER_FIELDS.map((field) => (
          <div key={field.id} className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-blue-400">{field.label}</label>
            <select
              value={mappings[field.id].csvHeader}
              onChange={(event) => updateMapping(field.id, event.target.value)}
              className="h-10 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 text-xs font-black text-white outline-none transition focus:border-blue-500"
            >
              <option value="">No importar</option>
              {field.id === "stock_proveedor" && isExcelFile ? (
                <option value={STOCK_COLOR_ROW}>Color de la fila (Excel)</option>
              ) : null}
              {csvHeaders.map((header) => (
                <option key={header} value={header}>{header}</option>
              ))}
            </select>
            {field.id === "proveedor" ? (
              <p className="text-[9px] font-bold text-slate-500">Si lo dejas vacio, se usa {nombre_proveedor}.</p>
            ) : null}
          </div>
        ))}
      </div>

      {mappings.stock_proveedor.csvHeader === STOCK_COLOR_ROW ? (
        <div className="rounded-lg border border-slate-700 bg-slate-950/60 p-3">
          <div className="text-[10px] font-black uppercase tracking-widest text-blue-400">Significado de colores</div>
          <p className="mt-1 text-[10px] font-bold text-slate-400">Elegí qué significa cada color detectado en este Excel.</p>
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={saveStockColorRules}
              disabled={savingStockColorRules || stockColorRules.length === 0}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-700 px-3 text-[9px] font-black uppercase tracking-widest text-slate-300 transition hover:border-slate-500 hover:text-white disabled:opacity-50"
            >
              <HiSave className="h-3.5 w-3.5" />
              {savingStockColorRules ? "Guardando" : "Guardar colores"}
            </button>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {stockColorRules.map((rule) => (
              <div key={rule.color || "sin-color"} className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/50 p-2">
                <span
                  className="h-7 w-7 shrink-0 rounded border border-slate-600"
                  style={{ backgroundColor: rule.color ? `#${colorKey(rule.color)}` : "#FFFFFF" }}
                  title={colorLabel(rule.color)}
                />
                <div className="min-w-0 flex-1">
                  <label className="flex items-center justify-between gap-2 text-[9px] font-black uppercase tracking-widest text-slate-400">
                    <span className="truncate">{colorLabel(rule.color)}</span>
                    <input
                      type="checkbox"
                      checked={rule.activo}
                      onChange={(event) => updateStockColorRule(rule.color, { activo: event.target.checked })}
                      className="h-3.5 w-3.5 shrink-0 rounded border-slate-600 bg-slate-950 text-blue-600"
                      title="Usar este color"
                    />
                  </label>
                  <select
                    value={rule.estado}
                    onChange={(event) => updateStockColorRule(rule.color, { estado: event.target.value as EstadoStockProveedor })}
                    disabled={!rule.activo}
                    className="mt-1 h-8 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-[10px] font-black text-white outline-none focus:border-blue-500 disabled:opacity-50"
                  >
                    <option value="DISPONIBLE">Disponible</option>
                    <option value="POR_PEDIDO">Por pedido</option>
                    <option value="DEMORADO">Demorado</option>
                    <option value="CONSULTE">Consulte</option>
                    <option value="PROXIMAMENTE">Proximamente</option>
                    <option value="PROXIMO_INGRESO">Proximo ingreso</option>
                    <option value="SIN_STOCK">Sin stock</option>
                    <option value="DESCONOCIDO">Desconocido</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {renderStats()}
      {renderPreview()}

      <button
        type="button"
        onClick={handleImport}
        disabled={!canImport || importing}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-blue-500 disabled:opacity-50"
      >
        <HiPlay className="h-4 w-4" />
        Importar {mappedData.items.length} filas
      </button>
    </div>
  );

  const renderUpload = () => (
    <div className={compact ? "space-y-3" : "flex flex-col gap-4"}>
      <div className={`${compact ? "rounded-xl px-4 py-7" : "rounded-2xl p-6"} border border-dashed border-slate-700 bg-slate-900/35 transition hover:border-blue-500/70 hover:bg-slate-900/55`}>
        <label className="flex cursor-pointer flex-col items-center justify-center text-center">
          <input type="file" className="hidden" accept=".csv,.xlsx,.xls" onChange={handleFileChange} />
          <div className={`${compact ? "h-14 w-14 rounded-2xl" : "h-16 w-16 rounded-2xl"} flex items-center justify-center bg-slate-800 text-white ring-1 ring-slate-700`}>
            <HiCloudUpload className={compact ? "h-7 w-7" : "h-8 w-8"} />
          </div>
          <h3 className={`${compact ? "text-sm" : "text-base"} mt-4 font-black uppercase tracking-tight text-white`}>Cargar lista de precios</h3>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Sube tu archivo CSV o Excel del proveedor</p>
          <span className="mt-4 inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-white px-5 text-[10px] font-black uppercase tracking-widest text-black shadow-sm transition hover:bg-slate-100">
            <HiTable className="h-4 w-4" />
            Seleccionar archivo
          </span>
        </label>
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
        <div className="flex items-start gap-2">
          <HiExclamation className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div>
            <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-300">Recomendaciones</h4>
            <ul className="mt-2 space-y-1 text-[11px] font-bold leading-relaxed text-amber-400">
              <li>El archivo puede estar en formato CSV o Excel.</li>
              <li>Debe tener columnas claras para codigo y precio.</li>
              <li>La columna de stock es opcional.</li>
              <li>Si no incluye proveedor, se usa el proveedor abierto.</li>
              <li>El orden no importa, podras mapearlas en el siguiente paso.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep = () => {
    if (step === "importing") return null;

    if (step === "results" && results) {
      return (
        <div className="space-y-3">
          <div className="rounded-xl border border-green-500/20 bg-green-500/10 px-3 py-3 text-xs font-black text-green-300">
            <div className="flex items-center gap-2">
              <HiCheck className="h-4 w-4" />
              Lista aplicada: {results.updatedCount} precios actualizados.
            </div>
          </div>
          {results.recalculatedCostCount > 0 && (
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-3 text-xs font-black text-blue-300">
              {results.recalculatedCostCount} item(s) con criterio automatico recalcularon costo y precios de venta.
            </div>
          )}
          {results.pendingApprovalCount > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-3 text-xs font-black text-amber-300">
              <span>{results.pendingApprovalCount} cambio(s) de costo esperan aprobacion.</span>
              <a href="/listados/precios-modificados" className="inline-flex h-8 items-center rounded-lg border border-amber-400/40 px-3 text-[10px] font-black uppercase tracking-widest transition hover:bg-amber-400/10">Revisar</a>
            </div>
          )}
          {results.notFoundCount > 0 && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-3 text-xs font-black text-amber-300">
              {results.notFoundCount} fila(s) no encontraron item con ese codigo en este proveedor.
            </div>
          )}
          {(results.invalidCount > 0 || results.duplicateCount > 0 || results.providerMismatchCount > 0) && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-3 text-xs font-black text-amber-300">
              {results.invalidCount} invalida(s), {results.duplicateCount} duplicada(s), {results.providerMismatchCount} de otro proveedor.
            </div>
          )}
          <button
            type="button"
            onClick={() => { window.location.href = `/api/listados/precios-modificados/export?importacion=${results.idImportacion}`; }}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-blue-500/40 px-3 text-[10px] font-black uppercase tracking-widest text-blue-300 transition hover:bg-blue-500/10"
          >
            <HiDownload className="h-4 w-4" />
            Exportar costos modificados
          </button>
          <button
            type="button"
            onClick={() => setStep("upload")}
            className="h-9 rounded-lg border border-slate-700 px-3 text-[10px] font-black uppercase tracking-widest text-slate-300 transition hover:bg-slate-900"
          >
            Importar otra
          </button>
        </div>
      );
    }

    if (step === "mapping") return renderMapping();
    return renderUpload();
  };

  return (
    <div className="flex flex-col gap-6">
      {renderStep()}
      <TransferProgressModal
        open={importing}
        title={importPhase === "uploading" ? "Cargando lista de precios" : importPhase === "validating" ? "Validando lista de precios" : "Aplicando lista de precios"}
        description={importPhase === "uploading"
          ? "Guardando las filas por partes. No cierres esta ventana."
          : importPhase === "validating"
            ? "Verificando codigos, proveedor y duplicados antes de actualizar."
            : "Actualizando precios, stock y costos por bloques confirmados."}
        total={importPhase === "uploading" ? mappedData.items.length : applicationTotal}
        processed={processedRows}
        unit="filas"
        elapsedMs={elapsedMs}
        estimatedRemainingMs={estimatedRemainingMs}
      />

      {!hideHistory && (
        <div className="mt-4">
          <div className="mb-4 flex items-center gap-2">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Historial de importaciones</h3>
          </div>
          <ProveedorImportHistory id_proveedor={id_proveedor} />
        </div>
      )}
    </div>
  );
}
