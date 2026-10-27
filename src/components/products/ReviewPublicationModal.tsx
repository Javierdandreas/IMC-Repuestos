"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { loteBloqueado, validarTitulosLote } from "@/lib/mercadolibre-lote-validacion";
import { loteFinalizado, type ItemResumenLote } from "@/lib/resumen-lote-publicacion";

type Link = { id: number; itemId: string; titulo: string; estado: string };
type Review = {
  itemId: string; titulo: string; userProductId: string | null; descripcionTexto: string; descripcionDisponible: boolean | null;
  compatibilidades: { total: number | null; muestras: number } | null;
};
export type CompatibilidadResultado = { estado: string; origen: number | null; destino: number | null; status?: number; detalle?: string };
export type ResultadoPublicacion = { resultado: string; mensaje?: string; publicacion?: string; titulo?: string | null; estado?: string | null; status?: number; respuesta?: unknown; descripcionEstado?: string; compatibilidades?: CompatibilidadResultado };
type Lote = { id: string; publicacion: number; descripcion: string; items: Array<{ posicion: number; titulo: string; descripcion: string | null; estado: string; resultado: ResultadoPublicacion | null }> };

export function resumenCompatibilidad(value?: CompatibilidadResultado) {
  if (!value) return "No se pudo comprobar la copia de compatibilidades.";
  if (value.estado === "COMPARTIDAS") return "La publicacion comparte el producto y sus compatibilidades.";
  if (value.estado === "SIN_ORIGEN") return "La publicacion original no informa compatibilidades.";
  if (value.estado === "SOLICITADA") return "COMPATIBILIDADES: COPIADAS";
  if (value.estado === "SOLICITADA_SIN_VERIFICAR") return "Copia solicitada, pero no se pudo verificar el destino.";
  return `No se pudieron copiar o verificar las compatibilidades.${value.status ? ` HTTP ${value.status}.` : ""}${value.detalle ? ` ${value.detalle}` : ""}`;
}

export function ReviewPublicationModal({ product, onClose, onPublished, onLoteTerminado }: { product: { id: number; tipo: "ITEM" | "KIT"; descripcion: string }; onClose: () => void; onPublished: (result: ResultadoPublicacion) => void; onLoteTerminado: (items: ItemResumenLote[]) => void }) {
  const [links, setLinks] = useState<Link[] | null>(null);
  const [selected, setSelected] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [loading, setLoading] = useState(false);
  const [intentoRevision, setIntentoRevision] = useState(0);
  const [generando, setGenerando] = useState(false);
  const [intento, setIntento] = useState(false);
  const [resultado, setResultado] = useState<ResultadoPublicacion | null>(null);
  const [error, setError] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [destino, setDestino] = useState("");
  const [copiando, setCopiando] = useState(false);
  const [copia, setCopia] = useState<CompatibilidadResultado | null>(null);
  const [modo, setModo] = useState<"individual" | "lote">("individual");
  const [titulosLote, setTitulosLote] = useState("");
  const [descripcionPorTitulo, setDescripcionPorTitulo] = useState(true);
  const [descripcionesLote, setDescripcionesLote] = useState<Record<string, string>>({});
  const [progresoDescripcion, setProgresoDescripcion] = useState("");
  const [lote, setLote] = useState<Lote | null>(null);
  const [loteCargando, setLoteCargando] = useState(false);
  const [historialListo, setHistorialListo] = useState(false);
  const [confirmandoLote, setConfirmandoLote] = useState(false);
  const bloqueoLote = useRef(false);
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ tipo: product.tipo, id: String(product.id) });
    fetch(`/api/integraciones/mercadolibre/vinculos?${params}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "No se pudieron consultar las publicaciones.");
        if (controller.signal.aborted) return;
        const vinculos = data as Link[];
        setLinks(vinculos);
        setSelected(vinculos.length === 1 ? String(vinculos[0].id) : "");
      }).catch((err) => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "No se pudieron consultar las publicaciones."); });
    return () => controller.abort();
  }, [product.id, product.tipo]);

  useEffect(() => {
    if (!selected) { setLoading(false); setReview(null); return; }
    const controller = new AbortController();
    setLoading(true); setError(""); setReview(null);
    const params = new URLSearchParams({ tipo: product.tipo, id: String(product.id), publicacion: selected });
    fetch(`/api/integraciones/mercadolibre/publicaciones/revisar-duplicacion?${params}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "No se pudo revisar la publicacion.");
        if (!controller.signal.aborted) { setReview(data); setNombre(data.titulo || ""); setDescripcion(data.descripcionTexto || ""); }
      })
      .catch((err) => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "No se pudo revisar la publicacion."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [selected, product.tipo, product.id, intentoRevision]);

  useEffect(() => {
    if (modo !== "lote") return;
    setHistorialListo(false);
    const controller = new AbortController();
    const params = new URLSearchParams({ tipo: product.tipo, id: String(product.id) });
    fetch(`/api/integraciones/mercadolibre/publicaciones/lotes?${params}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => { if (!response.ok) throw new Error("No se pudo consultar el ultimo lote."); return response.json(); })
      .then((data) => { setLote(data || null); setHistorialListo(true); })
      .catch((err) => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "No se pudo consultar el ultimo lote."); });
    return () => controller.abort();
  }, [product.id, product.tipo, modo]);

  const procesarLote = async (inicial: Lote) => {
    let actual = inicial;
    while (montado.current && actual.items.some((item) => item.estado === "PENDIENTE") && !loteBloqueado(actual.items)) {
      const response = await fetch("/api/integraciones/mercadolibre/publicaciones/lotes", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: product.tipo, id: product.id, lote: actual.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No se pudo confirmar el resultado del lote.");
      actual = data as Lote;
      if (montado.current) setLote(actual);
    }
    if (montado.current && loteFinalizado(actual.items)) onLoteTerminado(actual.items);
  };

  const iniciarLote = async () => {
    if (bloqueoLote.current) return;
    bloqueoLote.current = true; setLoteCargando(true); setConfirmandoLote(false); setError("");
    try {
      const response = await fetch("/api/integraciones/mercadolibre/publicaciones/lotes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: product.tipo, id: product.id, publicacion: Number(selected), titulos: titulosLote.split(/\r?\n/).map((line) => line.trim()).filter(Boolean), descripcion, ...(descripcionPorTitulo ? { descripciones: titulosLote.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((titulo) => descripcionesLote[titulo]) } : {}), confirmar: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No se pudo guardar el lote.");
      setLote(data); await procesarLote(data);
    } catch (err) { setError(`${err instanceof Error ? err.message : "No se pudo confirmar el resultado."} Consulta el ultimo lote y Mercado Libre antes de volver a publicar.`); }
    finally { bloqueoLote.current = false; setLoteCargando(false); }
  };

  const continuarLote = async () => {
    if (!lote || bloqueoLote.current) return;
    bloqueoLote.current = true; setLoteCargando(true); setError("");
    try { await procesarLote(lote); }
    catch (err) { setError(`${err instanceof Error ? err.message : "No se pudo confirmar el resultado."} Revisa Mercado Libre antes de continuar.`); }
    finally { bloqueoLote.current = false; setLoteCargando(false); }
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

  const generarDescripcionesLote = async () => {
    setGenerando(true); setError("");
    const pendientes = titulos.filter((titulo) => !descripcionesLote[titulo]?.trim());
    try {
      for (const [index, titulo] of pendientes.entries()) {
        if (!montado.current) break;
        setProgresoDescripcion(`${index + 1}/${pendientes.length}`);
        const response = await fetch("/api/integraciones/mercadolibre/publicaciones/generar-descripcion", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tipo: product.tipo, id: product.id, publicacion: Number(selected), nombre: titulo }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || `No se pudo generar la descripcion de ${titulo}.`);
        if (montado.current) setDescripcionesLote((actual) => ({ ...actual, [titulo]: data.descripcion }));
      }
    } catch (err) { if (montado.current) setError(err instanceof Error ? err.message : "No se pudieron generar las descripciones."); }
    finally { if (montado.current) { setGenerando(false); setProgresoDescripcion(""); } }
  };

  const publicar = async () => {
    if (!review) return;
    setConfirmando(false); setIntento(true); setError("");
    try {
      const response = await fetch("/api/integraciones/mercadolibre/publicaciones/probar-duplicacion", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: product.tipo, id: product.id, publicacion: Number(selected), nombre, descripcion, confirmar: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No se pudo confirmar el resultado.");
      if (data.resultado === "CREADA") onPublished(data);
      else setResultado(data);
    } catch { setResultado({ resultado: "INCIERTO", mensaje: "No se pudo confirmar el resultado. Revisa las publicaciones de la cuenta antes de volver a intentar." }); }
  };

  const copiarExistente = async () => {
    setCopiando(true); setError(""); setCopia(null);
    try {
      const response = await fetch("/api/integraciones/mercadolibre/publicaciones/copiar-compatibilidades", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: product.tipo, id: product.id, publicacion: Number(selected), destino: destino.trim().toUpperCase() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No se pudo copiar las compatibilidades.");
      setCopia(data);
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo confirmar la copia. Revisa el destino antes de volver a intentar."); }
    finally { setCopiando(false); }
  };

  const tituloValido = nombre.trim().length > 0 && nombre.length <= 60;
  const titulos = titulosLote.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const titulosValidos = validarTitulosLote(titulos);
  const descripcionesCompletas = titulos.every((titulo) => Boolean(descripcionesLote[titulo]?.trim()));
  if (confirmandoLote && review) return <Modal title="Confirmar lote" open onClose={() => setConfirmandoLote(false)} width="w-[min(96vw,560px)]"><div className="space-y-4 p-6 text-sm">
    <p>Se crearan {titulos.length} publicaciones reales desde {review.itemId}, {descripcionPorTitulo ? "con la descripcion revisada para cada titulo" : "con la misma descripcion"} y las compatibilidades disponibles del vendedor.</p>
    <p>Mercado Libre puede agrupar publicaciones y omitir compatibilidades de catalogo o con reclamos. Revisa que los datos correspondan a todos los titulos.</p>
    <div className="flex justify-end gap-2"><button type="button" onClick={() => setConfirmandoLote(false)} className="rounded-md border border-slate-500 px-4 py-2 text-xs font-bold">Cancelar</button><button type="button" onClick={() => void iniciarLote()} className="rounded-md bg-blue-600 px-4 py-2 text-xs font-bold text-white">Confirmar lote</button></div>
  </div></Modal>;
  if (confirmando && review) return <Modal title="Confirmar publicacion" open onClose={() => setConfirmando(false)} width="w-[min(96vw,560px)]">
    <div className="space-y-4 p-6 text-sm text-slate-700 dark:text-slate-200">
      <p className="font-bold">{nombre}</p>
      <p>Origen: {review.itemId}</p>
      <p>Se creara una publicacion real con los datos actuales de la original. Mercado Libre puede agruparla con otras y afectar datos compartidos.</p>
      <p>Se intentara copiar las compatibilidades del vendedor, con notas y restricciones. Revisalas antes de vender.</p>
      <div className="flex justify-end gap-2"><button type="button" onClick={() => setConfirmando(false)} className="rounded-md border border-slate-500 px-4 py-2 text-xs font-bold">Cancelar</button><button type="button" onClick={() => void publicar()} className="rounded-md bg-blue-600 px-4 py-2 text-xs font-bold text-white">Confirmar publicacion</button></div>
    </div>
  </Modal>;
  if (intento && !resultado && review) return <Modal title="Publicando copia" open onClose={() => {}} hideClose width="w-[min(96vw,560px)]">
    <div role="status" className="space-y-3 p-6 text-sm text-slate-700 dark:text-slate-200">
      <p className="font-bold">Publicando...</p>
      <p className="text-xs text-slate-500">Origen: {review.itemId}</p>
      <p className="break-words font-bold">{nombre}</p>
    </div>
  </Modal>;
  if (loteCargando) {
    const items = lote?.items ?? titulos.map((titulo, posicion) => ({ posicion, titulo, estado: "PENDIENTE", resultado: null, descripcion: descripcionPorTitulo ? descripcionesLote[titulo] : null }));
    const finalizadas = items.filter((item) => item.estado === "CREADA" || item.estado === "RECHAZADA").length;
    const origen = lote ? links?.find((link) => link.id === lote.publicacion)?.itemId : review?.itemId;
    return <Modal title="Publicando lote" open onClose={() => {}} hideClose width="w-[min(96vw,680px)]">
      <div className="space-y-4 p-6 text-sm text-slate-700 dark:text-slate-200">
        <div role="status"><p className="font-bold">{lote ? "Publicando..." : "Preparando lote..."}</p><p className="mt-1 text-xs text-slate-500">{finalizadas} de {items.length} procesadas</p><p className="mt-2 text-xs">Origen: {origen || "No disponible"}</p></div>
        <div className="max-h-[50vh] space-y-2 overflow-y-auto">{items.map((item) => <div key={item.posicion} className="border-b border-slate-200 pb-2 text-xs dark:border-slate-800"><p className="font-bold">{item.posicion + 1}. {item.titulo}</p><p>{item.estado}{item.resultado?.publicacion ? ` - ${item.resultado.publicacion}` : ""}</p>{item.resultado?.mensaje && <p>{item.resultado.mensaje}</p>}{item.resultado?.descripcionEstado && <p>Descripcion: {item.resultado.descripcionEstado}</p>}{item.resultado?.compatibilidades && <p>{resumenCompatibilidad(item.resultado.compatibilidades)}</p>}</div>)}</div>
        {items.some((item) => item.descripcion != null) && <details><summary className="cursor-pointer text-xs font-bold">Ver descripciones</summary>{items.map((item) => <div key={item.posicion} className="mt-2 text-xs"><p className="font-bold">{item.titulo}</p><p className="whitespace-pre-wrap">{item.descripcion ?? lote?.descripcion}</p></div>)}</details>}
      </div>
    </Modal>;
  }
  return <Modal title="Duplicar publicacion" open onClose={() => { if (!loteCargando && (!intento || resultado)) onClose(); }} width="w-[min(96vw,680px)]">
    <div className="space-y-4 p-6 text-sm text-slate-700 dark:text-slate-200">
      <p className="font-bold">{product.descripcion}</p>
      {links === null && !error && <p>Cargando publicaciones vinculadas...</p>}
      {links?.length === 0 && <p>No hay publicaciones de Mercado Libre vinculadas.</p>}
      {links && links.length > 0 && <div className="space-y-2">
        <label htmlFor="publicacion-origen" className="block text-xs font-bold">Publicacion de origen</label>
        <select id="publicacion-origen" value={selected} disabled={intento || generando || loteCargando} onChange={(event) => { setSelected(event.target.value); setReview(null); setDescripcionesLote({}); setError(""); }} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
          <option value="">Seleccionar publicacion</option>
          {links.map((link) => <option key={link.id} value={link.id}>{link.itemId} - {link.titulo} ({link.estado})</option>)}
        </select>
        {loading && <p role="status" className="text-xs text-slate-500">Consultando publicacion...</p>}
        {!loading && selected && !review && error && <button type="button" onClick={() => setIntentoRevision((value) => value + 1)} className="h-9 rounded-md border border-blue-500 px-3 text-xs font-bold text-blue-600 dark:text-blue-300">Reintentar consulta</button>}
      </div>}
      {error && <p role="alert" className="text-red-600 dark:text-red-300">{error}</p>}
      {review && <div className="space-y-4 border-t border-slate-200 pt-4 dark:border-slate-800">
        <p className="font-bold">Compatibilidades: {review.compatibilidades === null ? "No se pudieron consultar" : review.compatibilidades.total ?? review.compatibilidades.muestras}</p>
        <div role="group" aria-label="Modo de publicacion" className="inline-flex rounded-md border border-slate-300 p-1 dark:border-slate-700"><button type="button" disabled={loteCargando || intento || generando} aria-pressed={modo === "individual"} onClick={() => setModo("individual")} className={`rounded px-3 py-1 text-xs font-bold ${modo === "individual" ? "bg-blue-600 text-white" : "text-slate-500"}`}>Individual</button><button type="button" disabled={loteCargando || intento || generando} aria-pressed={modo === "lote"} onClick={() => setModo("lote")} className={`rounded px-3 py-1 text-xs font-bold ${modo === "lote" ? "bg-blue-600 text-white" : "text-slate-500"}`}>Por lote</button></div>
        {modo === "individual" && <div className="space-y-1">
          <label htmlFor="nombre-copia" className="block text-xs font-bold">{review.userProductId ? "Nombre de familia" : "Titulo"}</label>
          <input id="nombre-copia" value={nombre} maxLength={60} disabled={intento || generando} onChange={(event) => setNombre(event.target.value)} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-950" />
          <p className={`text-right text-xs ${nombre.length > 60 ? "text-red-500" : "text-slate-500"}`}>{nombre.length}/60</p>
        </div>}
        {modo === "lote" && !lote && <div className="space-y-2"><label htmlFor="titulos-lote" className="block text-xs font-bold">Titulos, uno por linea</label><textarea id="titulos-lote" value={titulosLote} onChange={(event) => setTitulosLote(event.target.value)} disabled={loteCargando || generando} rows={6} className="w-full rounded-md border border-slate-300 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950" /><p className="text-xs text-slate-500">{titulos.length}/20 titulos</p><div className="max-h-32 space-y-1 overflow-auto text-xs">{titulos.map((line, index) => <p key={index} className={line.length > 60 ? "text-red-500" : "text-slate-500"}>{index + 1}. {line} <span className="font-bold">{line.length}/60</span></p>)}</div>{titulos.length > 0 && !titulosValidos && <p role="alert" className="text-xs text-red-500">Revisa el limite de 20 titulos, los 60 caracteres y los titulos repetidos.</p>}</div>}
        {modo === "lote" && !lote && <div role="group" aria-label="Descripcion del lote" className="inline-flex rounded-md border border-slate-300 p-1 dark:border-slate-700"><button type="button" disabled={generando} aria-pressed={descripcionPorTitulo} onClick={() => setDescripcionPorTitulo(true)} className={`rounded px-3 py-1 text-xs font-bold ${descripcionPorTitulo ? "bg-blue-600 text-white" : "text-slate-500"}`}>Por titulo</button><button type="button" disabled={generando} aria-pressed={!descripcionPorTitulo} onClick={() => setDescripcionPorTitulo(false)} className={`rounded px-3 py-1 text-xs font-bold ${!descripcionPorTitulo ? "bg-blue-600 text-white" : "text-slate-500"}`}>Comun</button></div>}
        {modo === "lote" && !lote && descripcionPorTitulo && <div className="space-y-3"><div className="flex items-center justify-between gap-2"><p className="text-xs font-bold">Descripciones por titulo</p><button type="button" onClick={() => void generarDescripcionesLote()} disabled={!titulosValidos || generando || descripcionesCompletas} className="rounded-md border border-blue-500 px-3 py-2 text-xs font-bold text-blue-600 disabled:opacity-50 dark:text-blue-300">{generando ? `Generando ${progresoDescripcion}` : "Generar con ChatGPT"}</button></div>{titulos.map((titulo, index) => <div key={titulo} className="space-y-1"><label htmlFor={`descripcion-lote-${index}`} className="block text-xs font-bold">{index + 1}. {titulo}</label><textarea id={`descripcion-lote-${index}`} rows={4} maxLength={50000} disabled={generando} value={descripcionesLote[titulo] ?? ""} onChange={(event) => setDescripcionesLote((actual) => ({ ...actual, [titulo]: event.target.value }))} className="w-full resize-y rounded-md border border-slate-300 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950" /></div>)}</div>}
        {(modo === "individual" || (modo === "lote" && ((!lote && !descripcionPorTitulo) || (lote && lote.items.every((item) => item.descripcion === null))))) && <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2"><label htmlFor="descripcion-copia" className="text-xs font-bold">{modo === "lote" ? "Descripcion para todas" : "Descripcion"}</label><button type="button" onClick={() => void generar()} disabled={!tituloValido || generando || intento || loteCargando || (modo === "lote" && !!lote)} className="rounded-md border border-blue-500 px-3 py-2 text-xs font-bold text-blue-600 disabled:opacity-50 dark:text-blue-300">{generando ? "Generando..." : "Generar con ChatGPT"}</button></div>
          <textarea id="descripcion-copia" value={modo === "lote" && lote ? lote.descripcion : descripcion} maxLength={50000} disabled={intento || generando || loteCargando || (modo === "lote" && !!lote)} onChange={(event) => setDescripcion(event.target.value)} rows={7} className="w-full resize-y rounded-md border border-slate-300 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950" />
          {review.descripcionDisponible === null && <p className="text-amber-700 dark:text-amber-300">No se pudo consultar la descripcion original.</p>}
        </div>}
        {modo === "individual" && <button type="button" onClick={() => setConfirmando(true)} disabled={!tituloValido || intento || generando} className="rounded-md bg-blue-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{intento && !resultado ? "Publicando..." : "Publicar copia"}</button>}
        {modo === "lote" && !historialListo && <p className="text-xs text-amber-600">Es necesario consultar el ultimo lote antes de publicar. Si hubo un error, vuelve a abrir esta opcion.</p>}
        {modo === "lote" && !lote && <button type="button" onClick={() => setConfirmandoLote(true)} disabled={!historialListo || !titulosValidos || (descripcionPorTitulo && !descripcionesCompletas) || generando || loteCargando} className="rounded-md bg-blue-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">Publicar lote</button>}
        {modo === "lote" && lote && <div role="status" className="space-y-3 border-t border-slate-300 pt-3 dark:border-slate-700"><p className="font-bold">Ultimo lote {loteCargando ? "- Publicando..." : ""}</p><p className="text-xs">Origen: {links?.find((link) => link.id === lote.publicacion)?.itemId || "No disponible"}</p><div className="max-h-64 space-y-2 overflow-auto">{lote.items.map((item) => <div key={item.posicion} className="border-b border-slate-200 pb-2 text-xs dark:border-slate-800"><p className="font-bold">{item.posicion + 1}. {item.titulo}</p><p>{item.estado}{item.resultado?.publicacion ? ` - ${item.resultado.publicacion}` : ""}</p>{item.resultado?.mensaje && <p>{item.resultado.mensaje}</p>}{item.resultado?.descripcionEstado && <p>Descripcion: {item.resultado.descripcionEstado}</p>}{item.resultado?.compatibilidades && <p>{resumenCompatibilidad(item.resultado.compatibilidades)}</p>}{item.resultado?.respuesta != null && <pre className="whitespace-pre-wrap break-all">{JSON.stringify(item.resultado.respuesta, null, 2)}</pre>}</div>)}</div>
          {lote.items.some((item) => item.estado === "EJECUTANDO" || item.estado === "INCIERTO") && <p className="text-amber-600 dark:text-amber-300">Hay un resultado sin confirmar. Revisa Mercado Libre antes de crear otro lote; no se continuara automaticamente.</p>}
          {!loteCargando && lote.items.some((item) => item.estado === "PENDIENTE") && !lote.items.some((item) => item.estado === "EJECUTANDO" || item.estado === "INCIERTO") && <button type="button" onClick={() => void continuarLote()} className="rounded-md border border-blue-500 px-3 py-2 text-xs font-bold text-blue-600">Continuar pendientes</button>}
          {lote.items.some((item) => item.descripcion !== null) && <details><summary className="cursor-pointer text-xs font-bold">Ver descripciones guardadas</summary>{lote.items.map((item) => <div key={item.posicion} className="mt-2 text-xs"><p className="font-bold">{item.titulo}</p><p className="whitespace-pre-wrap">{item.descripcion ?? lote.descripcion}</p></div>)}</details>}
          {!loteCargando && loteFinalizado(lote.items) && <button type="button" onClick={() => onLoteTerminado(lote.items)} className="mr-2 rounded-md border border-blue-500 px-3 py-2 text-xs font-bold text-blue-600">Volver al listado con resumen</button>}
          {!loteCargando && lote.items.every((item) => item.estado === "CREADA" || item.estado === "RECHAZADA") && <button type="button" onClick={() => { setLote(null); setTitulosLote(""); setDescripcionesLote({}); }} className="rounded-md border border-slate-500 px-3 py-2 text-xs font-bold">Crear otro lote</button>}
        </div>}
        {modo === "individual" && !intento && <details className="border-t border-slate-200 pt-3 dark:border-slate-800"><summary className="cursor-pointer text-xs font-bold">Copiar compatibilidades a una publicacion existente</summary><p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Comprueba el destino: la copia puede afectar otras publicaciones que compartan su producto.</p><div className="mt-3 flex flex-wrap gap-2"><input aria-label="ID de publicacion de destino" placeholder="MLA..." value={destino} onChange={(event) => { setDestino(event.target.value.toUpperCase()); setCopia(null); }} className="h-9 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-950" /><button type="button" onClick={() => void copiarExistente()} disabled={!/^MLA\d+$/.test(destino.trim()) || copiando} className="rounded-md border border-blue-500 px-3 text-xs font-bold text-blue-600 disabled:opacity-50 dark:text-blue-300">{copiando ? "Copiando..." : "Copiar compatibilidades"}</button></div>{copia && <p role="status" className="mt-2">{resumenCompatibilidad(copia)}</p>}</details>}
        {resultado && <div role="status" className="space-y-1">
          <p className="font-bold">{resultado.resultado === "CREADA" ? `Publicacion creada: ${resultado.publicacion}` : resultado.resultado === "RECHAZADA" ? `Mercado Libre rechazo la creacion (HTTP ${resultado.status}).` : "Resultado incierto."}</p>
          {resultado.mensaje && <p>{resultado.mensaje}</p>}
          {resultado.respuesta != null && <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(resultado.respuesta, null, 2)}</pre>}
        </div>}
      </div>}
    </div>
  </Modal>;
}
