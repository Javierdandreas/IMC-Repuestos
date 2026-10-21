"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";

type Link = { id: number; itemId: string; titulo: string; estado: string };
type Review = {
  itemId: string; titulo: string; userProductId: string | null; descripcionTexto: string; descripcionDisponible: boolean | null;
  compatibilidades: { total: number | null; muestras: number } | null;
};
type Resultado = { resultado: string; mensaje?: string; publicacion?: string; titulo?: string | null; estado?: string | null; status?: number; respuesta?: unknown; descripcionEstado?: string };

export function ReviewPublicationModal({ product, onClose }: { product: { id: number; tipo: "ITEM" | "KIT"; descripcion: string }; onClose: () => void }) {
  const [links, setLinks] = useState<Link[] | null>(null);
  const [selected, setSelected] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [loading, setLoading] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [intento, setIntento] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ tipo: product.tipo, id: String(product.id) });
    fetch(`/api/integraciones/mercadolibre/vinculos?${params}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "No se pudieron consultar las publicaciones.");
        setLinks(data as Link[]);
      }).catch((err) => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "No se pudieron consultar las publicaciones."); });
    return () => controller.abort();
  }, [product.id, product.tipo]);

  const check = async () => {
    setLoading(true); setError(""); setReview(null);
    try {
      const params = new URLSearchParams({ tipo: product.tipo, id: String(product.id), publicacion: selected });
      const response = await fetch(`/api/integraciones/mercadolibre/publicaciones/revisar-duplicacion?${params}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No se pudo revisar la publicacion.");
      setReview(data); setNombre(data.titulo || ""); setDescripcion(data.descripcionTexto || "");
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo revisar la publicacion."); }
    finally { setLoading(false); }
  };

  const generar = async () => {
    setGenerando(true); setError("");
    try {
      const response = await fetch("/api/integraciones/mercadolibre/publicaciones/generar-descripcion", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: product.tipo, id: product.id, publicacion: Number(selected), nombre }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No se pudo generar la descripcion.");
      setDescripcion(data.descripcion);
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo generar la descripcion."); }
    finally { setGenerando(false); }
  };

  const publicar = async () => {
    if (!review || !window.confirm(`Se creara una publicacion real usando los datos actuales de ${review.itemId}. Mercado Libre podria agruparla y afectar datos compartidos. Las compatibilidades NO se copiaran. Continuar?`)) return;
    setIntento(true); setError("");
    try {
      const response = await fetch("/api/integraciones/mercadolibre/publicaciones/probar-duplicacion", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: product.tipo, id: product.id, publicacion: Number(selected), nombre, descripcion, confirmar: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No se pudo confirmar el resultado.");
      setResultado(data);
    } catch { setResultado({ resultado: "INCIERTO", mensaje: "No se pudo confirmar el resultado. Revisa las publicaciones de la cuenta antes de volver a intentar." }); }
  };

  const tituloValido = nombre.trim().length > 0 && nombre.length <= 60;
  return <Modal title="Duplicar publicacion" open onClose={onClose} width="w-[min(96vw,680px)]">
    <div className="space-y-4 p-6 text-sm text-slate-700 dark:text-slate-200">
      <p className="font-bold">{product.descripcion}</p>
      {links === null && !error && <p>Cargando publicaciones vinculadas...</p>}
      {links?.length === 0 && <p>No hay publicaciones de Mercado Libre vinculadas.</p>}
      {links && links.length > 0 && <div className="space-y-2">
        <label htmlFor="publicacion-origen" className="block text-xs font-bold">Publicacion de origen</label>
        <select id="publicacion-origen" value={selected} disabled={intento || loading || generando} onChange={(event) => { setSelected(event.target.value); setReview(null); setError(""); }} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
          <option value="">Seleccionar publicacion</option>
          {links.map((link) => <option key={link.id} value={link.id}>{link.itemId} - {link.titulo} ({link.estado})</option>)}
        </select>
        <button type="button" onClick={() => void check()} disabled={!selected || loading || intento || generando} className="h-9 rounded-md bg-blue-600 px-3 text-xs font-bold text-white disabled:opacity-50">{loading ? "Consultando..." : "Revisar publicacion"}</button>
      </div>}
      {error && <p role="alert" className="text-red-600 dark:text-red-300">{error}</p>}
      {review && <div className="space-y-4 border-t border-slate-200 pt-4 dark:border-slate-800">
        <p className="font-bold">Compatibilidades: {review.compatibilidades === null ? "No se pudieron consultar" : review.compatibilidades.total ?? review.compatibilidades.muestras}</p>
        <div className="space-y-1">
          <label htmlFor="nombre-copia" className="block text-xs font-bold">{review.userProductId ? "Nombre de familia" : "Titulo"}</label>
          <input id="nombre-copia" value={nombre} maxLength={60} disabled={intento || generando} onChange={(event) => setNombre(event.target.value)} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-950" />
          <p className={`text-right text-xs ${nombre.length > 60 ? "text-red-500" : "text-slate-500"}`}>{nombre.length}/60</p>
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2"><label htmlFor="descripcion-copia" className="text-xs font-bold">Descripcion</label><button type="button" onClick={() => void generar()} disabled={!tituloValido || generando || intento} className="rounded-md border border-blue-500 px-3 py-2 text-xs font-bold text-blue-600 disabled:opacity-50 dark:text-blue-300">{generando ? "Generando..." : "Generar con ChatGPT"}</button></div>
          <textarea id="descripcion-copia" value={descripcion} maxLength={50000} disabled={intento || generando} onChange={(event) => setDescripcion(event.target.value)} rows={7} className="w-full resize-y rounded-md border border-slate-300 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950" />
          {review.descripcionDisponible === null && <p className="text-amber-700 dark:text-amber-300">No se pudo consultar la descripcion original.</p>}
        </div>
        <button type="button" onClick={() => void publicar()} disabled={!tituloValido || intento || generando} className="rounded-md bg-blue-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{intento && !resultado ? "Publicando..." : "Publicar copia"}</button>
        {resultado && <div role="status" className="space-y-1">
          <p className="font-bold">{resultado.resultado === "CREADA" ? `Publicacion creada: ${resultado.publicacion}` : resultado.resultado === "RECHAZADA" ? `Mercado Libre rechazo la creacion (HTTP ${resultado.status}).` : "Resultado incierto."}</p>
          {resultado.mensaje && <p>{resultado.mensaje}</p>}
          {resultado.resultado === "CREADA" && <><p>Titulo: {resultado.titulo || "Sin dato"} | Estado: {resultado.estado || "Sin dato"}</p><p>{resultado.descripcionEstado === "GUARDADA" ? "Descripcion guardada." : resultado.descripcionEstado === "SIN_DESCRIPCION" ? "Sin descripcion." : "No se confirmo el guardado de la descripcion. Revisa la publicacion creada."}</p><p>Las compatibilidades no se copiaron.</p></>}
          {resultado.respuesta != null && <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(resultado.respuesta, null, 2)}</pre>}
        </div>}
      </div>}
    </div>
  </Modal>;
}
