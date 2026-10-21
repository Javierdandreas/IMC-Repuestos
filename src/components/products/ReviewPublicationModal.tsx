"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";

type Link = { id: number; itemId: string; titulo: string; estado: string };
type Review = {
  itemId: string; titulo: string; estado: string; categoria: string; userProductId: string | null;
  sku: string | null; precio: number | null; moneda: string; stock: number | null; fotos: number | null;
  descripcionDisponible: boolean | null;
  compatibilidades: { total: number | null; muestras: number; vendedor: number; catalogo: number; sinOrigen: number } | null;
};

export function ReviewPublicationModal({ product, onClose }: { product: { id: number; tipo: "ITEM" | "KIT"; descripcion: string }; onClose: () => void }) {
  const [links, setLinks] = useState<Link[] | null>(null);
  const [selected, setSelected] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ tipo: product.tipo, id: String(product.id) });
    fetch(`/api/integraciones/mercadolibre/vinculos?${params}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "No se pudieron consultar las publicaciones.");
        setLinks(data as Link[]);
      })
      .catch((err) => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "No se pudieron consultar las publicaciones."); });
    return () => controller.abort();
  }, [product.id, product.tipo]);

  const check = async () => {
    setLoading(true); setError(""); setReview(null);
    try {
      const params = new URLSearchParams({ tipo: product.tipo, id: String(product.id), publicacion: selected });
      const response = await fetch(`/api/integraciones/mercadolibre/publicaciones/revisar-duplicacion?${params}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No se pudo revisar la publicacion.");
      setReview(data as Review);
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo revisar la publicacion."); }
    finally { setLoading(false); }
  };

  return <Modal title="Duplicar publicacion" open onClose={onClose} width="w-[min(96vw,680px)]">
    <div className="space-y-4 p-6 text-sm text-slate-700 dark:text-slate-200">
      <p className="font-bold">{product.descripcion}</p>
      {links === null && !error && <p>Cargando publicaciones vinculadas...</p>}
      {links?.length === 0 && <p>No hay publicaciones de Mercado Libre vinculadas a este {product.tipo === "KIT" ? "grupo" : "item"}.</p>}
      {links && links.length > 0 && <div className="space-y-2">
        <label htmlFor="publicacion-origen" className="block text-xs font-bold">Publicacion de origen</label>
        <select id="publicacion-origen" value={selected} onChange={(event) => { setSelected(event.target.value); setReview(null); setError(""); }} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
          <option value="">Seleccionar publicacion</option>
          {links.map((link) => <option key={link.id} value={link.id}>{link.itemId} - {link.titulo} ({link.estado})</option>)}
        </select>
        <button type="button" onClick={() => void check()} disabled={!selected || loading} className="h-9 rounded-md bg-blue-600 px-3 text-xs font-bold text-white disabled:opacity-50">{loading ? "Consultando..." : "Revisar publicacion"}</button>
      </div>}
      {error && <p role="alert" className="text-red-600 dark:text-red-300">{error}</p>}
      {review && <div className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-800">
        <h3 className="font-bold">{review.itemId} - {review.titulo}</h3>
        <p>Modelo: {review.userProductId ? `User Product (${review.userProductId})` : "Sin User Product informado"} | Estado: {review.estado || "Sin dato"}</p>
        <p>SKU: {review.sku || "Sin dato"} | Categoria: {review.categoria || "Sin dato"}</p>
        <p>Precio: {review.precio === null ? "Sin dato" : `${review.moneda} ${review.precio.toLocaleString("es-AR")}`} | Stock: {review.stock ?? "Sin dato"} | Fotos: {review.fotos ?? "Sin dato"}</p>
        <p>Descripcion: {review.descripcionDisponible === null ? "No se pudo consultar" : review.descripcionDisponible ? "Disponible" : "Sin descripcion informada"}</p>
        <p>Compatibilidades: {review.compatibilidades === null ? "No se pudieron consultar" : `Mercado Libre devolvio ${review.compatibilidades.muestras} registros${review.compatibilidades.total === null ? "" : ` de ${review.compatibilidades.total}`}; en esta respuesta: ${review.compatibilidades.vendedor} del vendedor, ${review.compatibilidades.catalogo} del catalogo y ${review.compatibilidades.sinOrigen} registros sin origen informado.`}</p>
        <p className="text-amber-700 dark:text-amber-300">La creacion de la copia todavia no esta habilitada.</p>
      </div>}
    </div>
  </Modal>;
}
