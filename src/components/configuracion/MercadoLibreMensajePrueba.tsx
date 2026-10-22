"use client";

import { useState } from "react";
import { MessageCircle, Search, Send } from "lucide-react";

type Consulta = { ventaId: string; packId: string; disponible: boolean; limite: number; anterior: { estado: string; detalle: string | null } | null };
type Resultado = { estado: string; detalle: string };

export function MercadoLibreMensajePrueba({ idCuenta }: { idCuenta: number }) {
  const [ventaId, setVentaId] = useState("");
  const [texto, setTexto] = useState("Gracias por tu compra!\nPara confirmar que este sea el producto correcto nos puedes indicar numero de chasis, modelo, año, version y motorizacion!\nEstamos atentos!");
  const [consulta, setConsulta] = useState<Consulta | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  async function ejecutar(accion: "consultar" | "enviar") {
    setOcupado(true); setError("");
    try {
      const response = await fetch("/api/integraciones/mercadolibre/mensajes/prueba", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idCuenta, ventaId: ventaId.trim(), accion, ...(accion === "enviar" ? { texto } : {}) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No se pudo completar la operacion.");
      if (accion === "consultar") { setConsulta(data); setResultado(null); }
      else { setResultado(data); setConfirmando(false); }
    } catch (err) {
      setError(accion === "enviar" ? `No se pudo confirmar el resultado. Revisa la conversacion en Mercado Libre antes de repetir. ${err instanceof Error ? err.message : ""}` : err instanceof Error ? err.message : "No se pudo consultar la venta.");
      if (accion === "enviar") { setConsulta(null); setConfirmando(false); }
    } finally { setOcupado(false); }
  }

  const limite = consulta?.limite ?? 350;
  return <section className="border-b border-slate-200 py-4 dark:border-slate-800" aria-label="Prueba de mensaje posventa">
    <div className="flex items-center gap-2 text-sm font-bold"><MessageCircle className="h-4 w-4" />Mensaje posventa: prueba individual</div>
    <div className="mt-3 flex flex-wrap items-end gap-2">
      <label className="text-xs font-bold">Numero de venta<input value={ventaId} onChange={(event) => { setVentaId(event.target.value); setConsulta(null); setResultado(null); setConfirmando(false); }} inputMode="numeric" maxLength={20} className="mt-1 block h-9 w-56 rounded border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950" /></label>
      <button type="button" onClick={() => void ejecutar("consultar")} disabled={ocupado || !/^\d{1,20}$/.test(ventaId)} className="inline-flex h-9 items-center gap-2 rounded border border-blue-500 px-3 text-xs font-bold text-blue-600 disabled:opacity-50 dark:text-blue-300"><Search className="h-4 w-4" />{ocupado ? "Consultando..." : "Consultar venta"}</button>
    </div>
    {consulta && <div className="mt-3 max-w-2xl space-y-2 text-sm"><p>Paquete: {consulta.packId} | {consulta.anterior ? `Intento anterior: ${consulta.anterior.estado}` : consulta.disponible ? "Mensaje personalizado disponible" : "Mensaje personalizado no disponible"}</p>
      {consulta.anterior?.detalle && <p>{consulta.anterior.detalle}</p>}
      {!consulta.anterior && consulta.disponible && <><label className="block text-xs font-bold" htmlFor="mensaje-venta-prueba">Mensaje</label><textarea id="mensaje-venta-prueba" rows={4} value={texto} maxLength={limite} onChange={(event) => { setTexto(event.target.value); setConfirmando(false); }} className="w-full rounded border border-slate-300 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-950" /><div className="text-right text-xs text-slate-500">{texto.length}/{limite}</div>
      {!resultado && !confirmando && <button type="button" disabled={ocupado || !texto.trim()} onClick={() => setConfirmando(true)} className="inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><Send className="h-4 w-4" />Enviar prueba</button>}
      {confirmando && !resultado && <div className="space-y-2 border-l-2 border-amber-500 pl-3"><p>Se enviara este mensaje al comprador de la venta {consulta.ventaId}. Confirma el envio.</p><div className="flex gap-2"><button type="button" disabled={ocupado} onClick={() => void ejecutar("enviar")} className="rounded bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{ocupado ? "Enviando..." : "Confirmar envio"}</button><button type="button" disabled={ocupado} onClick={() => setConfirmando(false)} className="rounded border border-slate-400 px-3 py-2 text-xs font-bold">Cancelar</button></div></div>}</>}
    </div>}
    {resultado && <p role="status" className="mt-3 text-sm font-semibold">{resultado.estado}: {resultado.detalle}</p>}
    {error && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-300">{error}</p>}
  </section>;
}
