"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { ArrowLeft, FileSpreadsheet, LoaderCircle, Upload } from "lucide-react";
import { toast } from "sonner";

type Tipo = "marcas" | "categorias" | "ubicaciones";

const detalles: Record<Tipo, { titulo: string; formato: string; encabezados: string[] }> = {
  marcas: { titulo: "Marcas", formato: "Una columna: Marca.", encabezados: ["Marca"] },
  categorias: { titulo: "Categorias y subcategorias", formato: "Dos columnas: Categoria y Subcategoria. La subcategoria puede quedar vacia.", encabezados: ["Categoria", "Subcategoria"] },
  ubicaciones: { titulo: "Ubicaciones", formato: "Una columna: Ubicacion.", encabezados: ["Ubicacion"] },
};

function readRows(rows: Record<string, unknown>[]) {
  return rows.filter((row) => Object.values(row).some((value) => String(value ?? "").trim()));
}

export function ImportarCatalogoMaestroPage({ tipo, canImport }: { tipo: Tipo; canImport: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const detail = detalles[tipo];
  const preview = useMemo(() => rows.slice(0, 5), [rows]);

  const selectFile = async (file?: File) => {
    if (!file) return;
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const parsed = readRows(XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" }));
      if (!parsed.length) throw new Error("El archivo no contiene filas.");
      if (parsed.length > 5000) throw new Error("Cada importacion admite hasta 5.000 filas.");
      setFileName(file.name);
      setRows(parsed);
    } catch (error) {
      setFileName(null);
      setRows([]);
      toast.error(error instanceof Error ? error.message : "No se pudo leer el archivo.");
    }
  };

  const importRows = async () => {
    if (!rows.length) return;
    try {
      setLoading(true);
      const response = await fetch(`/api/listados/base-de-datos/importar?tipo=${tipo}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filas: rows }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "No se pudo importar el catalogo.");
      toast.success(`Importacion completada: ${result.creados ?? 0} creados y ${result.ignorados ?? 0} sin cambios.`);
      if (result.errores?.length) toast.warning(`${result.errores.length} filas no pudieron procesarse.`);
      setRows([]);
      setFileName(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo importar el catalogo.");
    } finally {
      setLoading(false);
    }
  };

  return <main className="min-h-[calc(100dvh-4rem)] bg-slate-50 p-4 dark:bg-slate-950 md:p-6"><div className="mx-auto w-full max-w-4xl">
    <Link href="/listados/base-de-datos" className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-blue-600 dark:hover:text-blue-300"><ArrowLeft className="h-4 w-4" />Base de datos</Link>
    <header className="mt-5 border-b border-slate-200 pb-5 dark:border-slate-800"><p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Importar catalogo maestro</p><h1 className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{detail.titulo}</h1><p className="mt-1 text-sm text-slate-500">{detail.formato}</p></header>
    <section className="mt-6 border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <button type="button" disabled={!canImport || loading} onClick={() => inputRef.current?.click()} className="flex min-h-32 w-full flex-col items-center justify-center gap-3 border border-dashed border-slate-300 text-slate-600 transition hover:border-blue-500 hover:bg-blue-500/5 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"><FileSpreadsheet className="h-7 w-7 text-blue-600 dark:text-blue-300" /><span className="text-sm font-black">{fileName || "Seleccionar archivo CSV o Excel"}</span><span className="text-xs text-slate-500">Se utiliza la primera hoja del archivo.</span></button>
      <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(event) => void selectFile(event.target.files?.[0])} />
      {rows.length > 0 && <><p className="mt-5 text-sm font-bold text-slate-700 dark:text-slate-200">{rows.length.toLocaleString("es-AR")} filas listas para importar</p><div className="mt-3 overflow-x-auto border border-slate-200 dark:border-slate-800"><table className="w-full text-left text-xs"><thead className="bg-slate-50 dark:bg-slate-950"><tr>{detail.encabezados.map((header) => <th key={header} className="px-3 py-2 font-black text-slate-500">{header}</th>)}</tr></thead><tbody>{preview.map((row, index) => <tr key={index} className="border-t border-slate-100 dark:border-slate-800">{detail.encabezados.map((header) => <td key={header} className="px-3 py-2 text-slate-700 dark:text-slate-200">{String(row[header] ?? row[header === "Categoria" ? "Categoría" : header === "Subcategoria" ? "Subcategoría" : header === "Ubicacion" ? "Ubicación" : "Descripción"] ?? "-")}</td>)}</tr>)}</tbody></table></div><div className="mt-5 flex justify-end"><button type="button" onClick={() => void importRows()} disabled={!canImport || loading} className="inline-flex h-10 items-center gap-2 bg-blue-600 px-4 text-xs font-black text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">{loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{loading ? "Importando..." : "Importar filas"}</button></div></>}
    </section>
  </div></main>;
}
