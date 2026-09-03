"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { useRouter } from "next/navigation";
import {
  HiArrowLeft,
  HiCheck,
  HiCloudUpload,
  HiExclamation,
  HiPlay,
  HiRefresh,
  HiX,
} from "react-icons/hi";
import { useAppError } from "@/context/AppErrorContext";
import { TransferProgressModal } from "@/components/ui/TransferProgressModal";

type ImportField =
  | "nombre"
  | "documento"
  | "condicion_iva"
  | "comprobante_default"
  | "contacto"
  | "telefono"
  | "email"
  | "domicilio_fiscal"
  | "provincia"
  | "localidad"
  | "codigo_postal"
  | "activo"
  | "observaciones";
type ImportRow = Record<string, unknown>;
type ImportResult = {
  creados: number;
  actualizados: number;
  ignorados: number;
  errores: Array<{ fila: number; mensaje: string; nombre: string }>;
};

const fields: Array<{ key: ImportField; label: string; required?: boolean }> = [
  { key: "nombre", label: "Nombre", required: true },
  { key: "documento", label: "CUIT / DNI" },
  { key: "condicion_iva", label: "Condicion IVA" },
  { key: "comprobante_default", label: "Comprobante predeterminado" },
  { key: "contacto", label: "Contacto principal" },
  { key: "telefono", label: "Telefono" },
  { key: "email", label: "Email" },
  { key: "domicilio_fiscal", label: "Domicilio fiscal" },
  { key: "provincia", label: "Provincia" },
  { key: "localidad", label: "Localidad" },
  { key: "codigo_postal", label: "Codigo postal" },
  { key: "activo", label: "Estado" },
  { key: "observaciones", label: "Observaciones" },
];

const normalizeHeader = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-zA-Z0-9]+/g, " ")
  .trim()
  .toLowerCase();

const fieldAliases: Record<ImportField, string[]> = {
  nombre: ["nombre", "descripcion", "proveedor", "nombre proveedor"],
  documento: ["cuit dni", "cuit", "dni", "documento"],
  condicion_iva: ["condicion iva", "iva", "responsabilidad iva", "tipo iva"],
  comprobante_default: ["comprobante predeterminado", "comprobante default", "comprobante", "factura"],
  contacto: ["contacto principal", "contacto", "responsable"],
  telefono: ["telefono", "tel", "celular", "whatsapp"],
  email: ["email", "e mail", "correo"],
  domicilio_fiscal: ["domicilio fiscal", "direccion fiscal", "domicilio", "direccion"],
  provincia: ["provincia"],
  localidad: ["localidad", "ciudad"],
  codigo_postal: ["codigo postal", "cp"],
  activo: ["estado", "activo"],
  observaciones: ["observaciones", "notas", "comentarios"],
};

const valueOf = (row: ImportRow, header?: string) => header ? String(row[header] ?? "").trim() : "";

function detectMapping(headers: string[]) {
  const used = new Set<string>();
  return fields.reduce<Partial<Record<ImportField, string>>>((mapping, field) => {
    const header = headers.find((candidate) => {
      if (used.has(candidate)) return false;
      const normalized = normalizeHeader(candidate);
      return fieldAliases[field.key].some((alias) => normalized === alias || normalized.includes(alias));
    });
    if (header) {
      mapping[field.key] = header;
      used.add(header);
    }
    return mapping;
  }, {});
}

function normalizeIva(value: string) {
  const normalized = normalizeHeader(value).replace(/ /g, "_").toUpperCase();
  if (!normalized) return "";
  if (normalized.includes("MONOTRIB")) return "MONOTRIBUTO";
  if (normalized.includes("RESPONSABLE") && normalized.includes("INSCRIPT")) return "RESPONSABLE_INSCRIPTO";
  if (normalized.includes("CONSUMIDOR") && normalized.includes("FINAL")) return "CONSUMIDOR_FINAL";
  if (normalized.includes("NO_RESPONSABLE")) return "NO_RESPONSABLE";
  if (normalized.includes("EXENTO")) return "EXENTO";
  return normalized;
}

function normalizeComprobante(value: string) {
  const normalized = normalizeHeader(value).toUpperCase();
  if (!normalized) return "";
  if (normalized === "A" || normalized.includes("FACTURA A")) return "FACTURA_A";
  if (normalized === "B" || normalized.includes("FACTURA B")) return "FACTURA_B";
  return normalized.replace(/ /g, "_");
}

export function ProveedorCatalogImportPage() {
  const router = useRouter();
  const { showMessage } = useAppError();
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [mapping, setMapping] = useState<Partial<Record<ImportField, string>>>({});
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const preview = useMemo(() => rows.slice(0, 6), [rows]);
  const mappedCount = Object.values(mapping).filter(Boolean).length;
  const canImport = Boolean(mapping.nombre && rows.length > 0 && !isImporting);

  useEffect(() => {
    if (!result || result.ignorados > 0) return;
    const timer = window.setTimeout(() => router.push("/proveedores"), 1800);
    return () => window.clearTimeout(timer);
  }, [result, router]);

  const readFile = async (selectedFile: File) => {
    const isExcel = /\.(xlsx|xls)$/i.test(selectedFile.name);
    let parsedRows: ImportRow[] = [];

    if (isExcel) {
      const workbook = XLSX.read(await selectedFile.arrayBuffer(), { type: "array" });
      const firstSheet = workbook.SheetNames[0];
      if (!firstSheet) throw new Error("El archivo no tiene hojas para importar");
      parsedRows = XLSX.utils.sheet_to_json<ImportRow>(workbook.Sheets[firstSheet], { defval: "" });
    } else {
      const parsed = Papa.parse<ImportRow>(await selectedFile.text(), {
        header: true,
        skipEmptyLines: "greedy",
      });
      if (parsed.errors.length > 0) throw new Error("No se pudo leer el archivo CSV");
      parsedRows = parsed.data;
    }

    const availableHeaders = Array.from(new Set(parsedRows.flatMap((row) => Object.keys(row))));
    if (availableHeaders.length === 0 || parsedRows.length === 0) {
      throw new Error("El archivo no contiene filas con encabezados");
    }

    setFile(selectedFile);
    setHeaders(availableHeaders);
    setRows(parsedRows);
    setMapping(detectMapping(availableHeaders));
    setResult(null);
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = "";
    if (!selectedFile) return;

    try {
      await readFile(selectedFile);
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "No se pudo leer el archivo", "No se pudo leer el archivo");
    }
  };

  const updateMapping = (field: ImportField, header: string) => {
    setMapping((current) => {
      const next = { ...current, [field]: header || undefined };
      if (header) {
        fields.forEach((otherField) => {
          if (otherField.key !== field && next[otherField.key] === header) next[otherField.key] = undefined;
        });
      }
      return next;
    });
  };

  const handleImport = async () => {
    if (!mapping.nombre) {
      showMessage("Selecciona la columna Nombre antes de importar.", "Falta un campo obligatorio");
      return;
    }

    try {
      setIsImporting(true);
      const items = rows.map((row, index) => ({
        fila: index + 2,
        nombre: valueOf(row, mapping.nombre),
        documento: valueOf(row, mapping.documento),
        condicion_iva: normalizeIva(valueOf(row, mapping.condicion_iva)),
        comprobante_default: normalizeComprobante(valueOf(row, mapping.comprobante_default)),
        contacto: valueOf(row, mapping.contacto),
        telefono: valueOf(row, mapping.telefono),
        email: valueOf(row, mapping.email),
        domicilio_fiscal: valueOf(row, mapping.domicilio_fiscal),
        provincia: valueOf(row, mapping.provincia),
        localidad: valueOf(row, mapping.localidad),
        codigo_postal: valueOf(row, mapping.codigo_postal),
        activo: valueOf(row, mapping.activo),
        observaciones: valueOf(row, mapping.observaciones),
      }));
      const response = await fetch("/api/proveedores/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "No se pudieron importar proveedores");

      setResult(payload as ImportResult);
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "No se pudieron importar proveedores", "No se pudieron importar proveedores");
    } finally {
      setIsImporting(false);
    }
  };

  const reset = () => {
    setFile(null);
    setHeaders([]);
    setRows([]);
    setMapping({});
    setResult(null);
  };

  return (
    <main className="min-h-screen px-4 py-5 md:px-6">
      <div className="mx-auto w-full max-w-[1500px]">
        <Link
          href="/proveedores"
          className="mb-3 inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500 transition hover:text-blue-500 dark:text-slate-400"
        >
          <HiArrowLeft className="h-4 w-4" />
          Volver a proveedores
        </Link>

        <header className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-[#0f172a] p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-base font-black text-white">Importar proveedores</h1>
            <p className="mt-1 text-[11px] font-bold text-slate-500">Crea o actualiza proveedores desde un archivo CSV o Excel.</p>
          </div>
          {file ? (
            <button type="button" onClick={reset} className="inline-flex h-9 items-center gap-2 self-start rounded-lg border border-slate-700 px-3 text-[10px] font-black uppercase tracking-widest text-slate-300 transition hover:border-slate-500 hover:text-white sm:self-auto">
              <HiX className="h-4 w-4" />
              Cambiar archivo
            </button>
          ) : null}
        </header>

        {!file ? (
          <section className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <label className="group flex min-h-[300px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-800 bg-[#0f172a] p-6 text-center transition hover:border-blue-500/60 hover:bg-slate-900">
              <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileChange} />
              <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 transition group-hover:scale-105"><HiCloudUpload className="h-7 w-7" /></span>
              <span className="mt-4 text-base font-black text-white">Seleccionar CSV o Excel</span>
              <span className="mt-1 text-xs font-medium text-slate-500">Arrastra el archivo o hace clic para buscarlo</span>
              <span className="mt-4 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400">.csv, .xlsx o .xls</span>
            </label>

            <aside className="rounded-2xl border border-slate-800 bg-[#0f172a] p-4 shadow-sm">
              <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-amber-200">
                <HiExclamation className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                <div>
                  <h2 className="text-[11px] font-black uppercase tracking-widest">Antes de importar</h2>
                  <ul className="mt-2 space-y-1.5 text-xs font-medium text-amber-100/80">
                    <li>Nombre es el único dato obligatorio.</li>
                    <li>CUIT/DNI identifica al proveedor cuando está informado.</li>
                    <li>Los campos vacios no borran datos existentes.</li>
                    <li>Estado admite Activo, Inactivo, Si/No, True/False o 1/0.</li>
                  </ul>
                </div>
              </div>
            </aside>
          </section>
        ) : (
          <>
            <section className="mt-4 rounded-2xl border border-slate-800 bg-[#0f172a] p-4 shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-800 pb-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">Archivo seleccionado</p>
                  <h2 className="mt-1 truncate text-sm font-black text-white" title={file.name}>{file.name}</h2>
                </div>
                <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest">
                  <span className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-300">{rows.length} filas</span>
                  <span className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-300">{headers.length} columnas</span>
                  <button type="button" onClick={() => setMapping(detectMapping(headers))} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-blue-300 transition hover:bg-blue-500/20">
                    <HiRefresh className="h-3.5 w-3.5" />
                    Detectar
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/40">
                  <div className="grid grid-cols-[minmax(140px,0.7fr)_minmax(0,1fr)] border-b border-slate-800 bg-slate-900 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <span>Campo del sistema</span>
                    <span>Columna del archivo</span>
                  </div>
                  {fields.map((field) => (
                    <div key={field.key} className="grid grid-cols-[minmax(140px,0.7fr)_minmax(0,1fr)] items-center gap-3 border-b border-slate-800 px-3 py-3 last:border-b-0">
                      <span className="text-xs font-black text-slate-200">{field.label}{field.required ? <span className="ml-1 text-red-400">*</span> : null}</span>
                      <select value={mapping[field.key] || ""} onChange={(event) => updateMapping(field.key, event.target.value)} className="h-9 min-w-0 rounded-lg border border-slate-700 bg-slate-950 px-2 text-xs font-bold text-white outline-none focus:border-blue-500">
                        <option value="">No importar este campo</option>
                        {headers.map((header) => <option key={header} value={header}>{header}</option>)}
                      </select>
                    </div>
                  ))}
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/40">
                  <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-3 py-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vista previa</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">{mappedCount}/{fields.length} mapeados</span>
                  </div>
                  <div className="grid grid-cols-[minmax(115px,1.2fr)_110px_minmax(110px,1fr)_minmax(125px,1fr)_minmax(130px,1.1fr)_90px] gap-2 border-b border-slate-800 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-slate-500">
                    <span>Nombre</span><span>CUIT / DNI</span><span>IVA</span><span>Contacto</span><span>Ubicacion</span><span>Estado</span>
                  </div>
                  {preview.map((row, index) => (
                    <div key={index} className="grid grid-cols-[minmax(115px,1.2fr)_110px_minmax(110px,1fr)_minmax(125px,1fr)_minmax(130px,1.1fr)_90px] gap-2 border-b border-slate-800 px-3 py-2 text-[11px] font-bold text-slate-200 last:border-b-0">
                      <span className="truncate" title={valueOf(row, mapping.nombre)}>{valueOf(row, mapping.nombre) || "-"}</span>
                      <span className="truncate" title={valueOf(row, mapping.documento)}>{valueOf(row, mapping.documento) || "-"}</span>
                      <span className="truncate" title={normalizeIva(valueOf(row, mapping.condicion_iva))}>{normalizeIva(valueOf(row, mapping.condicion_iva)) || "-"}</span>
                      <span className="truncate" title={valueOf(row, mapping.contacto) || valueOf(row, mapping.email)}>{valueOf(row, mapping.contacto) || valueOf(row, mapping.email) || "-"}</span>
                      <span className="truncate" title={`${valueOf(row, mapping.provincia)} ${valueOf(row, mapping.localidad)}`.trim()}>{`${valueOf(row, mapping.provincia)} ${valueOf(row, mapping.localidad)}`.trim() || "-"}</span>
                      <span className="truncate" title={valueOf(row, mapping.activo)}>{valueOf(row, mapping.activo) || "-"}</span>
                    </div>
                  ))}
                </div>
              </div>

              {!mapping.nombre ? <p className="mt-3 text-xs font-bold text-amber-300">Selecciona la columna que contiene el nombre del proveedor para continuar.</p> : null}
              <div className="mt-4 flex justify-end border-t border-slate-800 pt-4">
                <button type="button" onClick={handleImport} disabled={!canImport} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">
                  <HiPlay className="h-4 w-4" />
                  {isImporting ? "Importando..." : `Importar ${rows.length} filas`}
                </button>
              </div>
            </section>

          </>
        )}
      </div>

      <TransferProgressModal open={isImporting} title="Importando proveedores" total={rows.length} unit="filas" />

      {result ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-[560px] rounded-2xl border border-slate-700 bg-[#0f172a] p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${result.ignorados > 0 ? "bg-amber-500/10 text-amber-300" : "bg-emerald-500/10 text-emerald-300"}`}>
                {result.ignorados > 0 ? <HiExclamation className="h-5 w-5" /> : <HiCheck className="h-5 w-5" />}
              </span>
              <div>
                <h2 className="text-base font-black text-white">Importacion finalizada</h2>
                <p className="mt-1 text-xs font-medium text-slate-400">
                  {result.ignorados > 0 ? "Algunas filas no se pudieron procesar." : "Los proveedores se actualizaron correctamente."}
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <ResultCard label="Creados" value={result.creados} tone="blue" />
              <ResultCard label="Actualizados" value={result.actualizados} tone="green" />
              <ResultCard label="Omitidos" value={result.ignorados} tone="amber" />
            </div>

            {result.errores.length > 0 ? (
              <div className="mt-4 space-y-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
                {result.errores.slice(0, 3).map((error, index) => (
                  <p key={`${error.fila}-${index}`} className="text-xs font-medium text-amber-100">
                    Fila {error.fila}{error.nombre ? `, ${error.nombre}` : ""}: {error.mensaje}
                  </p>
                ))}
                {result.errores.length > 3 ? <p className="text-xs font-bold text-amber-300">Y {result.errores.length - 3} errores mas.</p> : null}
              </div>
            ) : (
              <p className="mt-4 text-center text-[11px] font-bold text-slate-500">Volviendo al listado de proveedores...</p>
            )}

            <button type="button" onClick={() => router.push("/proveedores")} className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-lg bg-blue-600 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-blue-500">
              Volver a proveedores
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function ResultCard({ label, value, tone }: { label: string; value: number; tone: "blue" | "green" | "amber" }) {
  const tones = {
    blue: "border-blue-500/20 bg-blue-500/10 text-blue-300",
    green: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    amber: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  };
  return <div className={`rounded-xl border p-3 ${tones[tone]}`}><p className="text-[10px] font-black uppercase tracking-widest opacity-80">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>;
}
