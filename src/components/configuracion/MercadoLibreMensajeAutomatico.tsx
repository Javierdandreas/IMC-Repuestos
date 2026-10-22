"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Save } from "lucide-react";

type Config = { activo: boolean; texto: string; activado_at: string | null };
type Evento = { venta_id: string; estado: string; detalle: string | null; updated_at: string };
type Datos = { config: Config; eventos: Evento[] };

export function MercadoLibreMensajeAutomatico({ idCuenta }: { idCuenta: number }) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [activo, setActivo] = useState(false);
  const [texto, setTexto] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  async function cargar() {
    setError("");
    try {
      const response = await fetch(`/api/integraciones/mercadolibre/mensajes/automaticos?idCuenta=${idCuenta}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No se pudo consultar la configuracion.");
      setDatos(data); setActivo(data.config.activo); setTexto(data.config.texto);
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo consultar la configuracion."); }
  }
  useEffect(() => { void cargar(); }, [idCuenta]);

  async function guardar() {
    setGuardando(true); setError(""); setAviso("");
    try {
      const response = await fetch("/api/integraciones/mercadolibre/mensajes/automaticos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idCuenta, activo, texto }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No se pudo guardar.");
      setDatos(data); setActivo(data.config.activo); setTexto(data.config.texto); setAviso("Configuracion guardada.");
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo guardar."); }
    finally { setGuardando(false); }
  }

  return <section className="border-b border-slate-200 py-4 dark:border-slate-800" aria-label="Mensajes automaticos">
    <div className="flex flex-wrap items-center gap-3"><h2 className="text-sm font-bold">Mensajes automaticos de compatibilidad</h2>{datos && <span className={`text-xs font-bold ${datos.config.activo ? "text-emerald-600" : "text-slate-500"}`}>{datos.config.activo ? "Activo" : "Desactivado"}</span>}</div>
    {datos && <div className="mt-3 max-w-2xl space-y-3">
      <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={activo} onChange={(event) => setActivo(event.target.checked)} disabled={guardando} />Enviar a ventas nuevas pagadas</label>
      <label htmlFor="mensaje-automatico" className="block text-xs font-bold">Mensaje</label>
      <textarea id="mensaje-automatico" value={texto} onChange={(event) => setTexto(event.target.value)} maxLength={350} rows={4} className="w-full rounded border border-slate-300 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
      <div className="flex flex-wrap items-center gap-3"><button type="button" onClick={() => void guardar()} disabled={guardando || !texto.trim()} className="inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><Save className="h-4 w-4" />{guardando ? "Guardando..." : "Guardar"}</button><span className="text-xs text-slate-500">{texto.length}/350</span>{aviso && <span role="status" className="text-xs text-emerald-600">{aviso}</span>}</div>
      <p className="text-xs text-slate-500">Solo se consideran ventas creadas despues de activar. Mercado Libre puede limitar o moderar mensajes automaticos.</p>
      <details><summary className="cursor-pointer text-xs font-bold">Ultimos resultados ({datos.eventos.length})</summary><button type="button" onClick={() => void cargar()} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-blue-600"><RefreshCw className="h-3 w-3" />Actualizar</button><div className="mt-2 space-y-2">{datos.eventos.map((evento) => <div key={evento.venta_id} className="border-t border-slate-200 py-2 text-xs dark:border-slate-800"><span className="font-bold">{evento.venta_id}: {evento.estado}</span>{evento.detalle && <span> - {evento.detalle}</span>}</div>)}{datos.eventos.length === 0 && <p className="text-xs text-slate-500">Sin resultados.</p>}</div></details>
    </div>}
    {error && <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-300">{error}</p>}
  </section>;
}
