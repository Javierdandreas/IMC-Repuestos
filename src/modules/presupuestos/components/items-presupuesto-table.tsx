"use client";

import { Pencil, Trash2, Check, X } from "lucide-react";
import { useState } from "react";
import type { PresupuestoItem } from "../types/presupuesto";

type Props = {
  items: PresupuestoItem[];
  observaciones: string;
  total: number;
  onChangeObservaciones: (value: string) => void;
  onEliminarItem: (codigo: string) => void;
  onActualizarCantidad: (codigo: string, cantidad: number) => void;
  onActualizarPrecio: (codigo: string, precio: number) => void;
};

function formatearMoneda(valor: number) {
  return `$${valor.toLocaleString("es-AR")}`;
}

export function ItemsPresupuestoTable({
  items,
  observaciones,
  total,
  onChangeObservaciones,
  onEliminarItem,
  onActualizarCantidad,
  onActualizarPrecio,
}: Props) {
  const [editandoCodigo, setEditandoCodigo] = useState<string | null>(null);
  const [precioTemporal, setPrecioTemporal] = useState<number>(0);

  const manejarCambioCantidad = (codigo: string, valor: string) => {
    if (valor.trim() === "") {
      onActualizarCantidad(codigo, 1);
      return;
    }

    const numero = Number(valor);

    if (!Number.isFinite(numero) || numero <= 0) {
      onActualizarCantidad(codigo, 1);
      return;
    }

    onActualizarCantidad(codigo, Math.floor(numero));
  };

  return (
    <section className="overflow-hidden rounded-[24px] border border-[#e5e7eb] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
      <div className="border-b border-[#eef2f7] px-5 py-4">
        <h2 className="text-[20px] font-bold text-[#243047]">
          Ítems del presupuesto
        </h2>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="bg-[#fbfbfc]">
              <th className="border-b border-r border-[#e5e7eb] px-4 py-3 text-center text-[14px] font-semibold text-[#1f2937]">
                Acciones
              </th>
              <th className="border-b border-r border-[#e5e7eb] px-4 py-3 text-left text-[14px] font-semibold text-[#1f2937]">
                Código
              </th>
              <th className="border-b border-r border-[#e5e7eb] px-4 py-3 text-left text-[14px] font-semibold text-[#1f2937]">
                Descripción
              </th>
              <th className="border-b border-r border-[#e5e7eb] px-4 py-3 text-center text-[14px] font-semibold text-[#1f2937]">
                Cantidad
              </th>
              <th className="border-b border-r border-[#e5e7eb] px-4 py-3 text-center text-[14px] font-semibold text-[#1f2937]">
                Precio Unitario
              </th>
              <th className="border-b border-r border-[#e5e7eb] px-4 py-3 text-center text-[14px] font-semibold text-[#1f2937]">
                Stock
              </th>
              <th className="border-b border-r border-[#e5e7eb] px-4 py-3 text-center text-[14px] font-semibold text-[#1f2937]">
                Ubicación
              </th>
              <th className="border-b border-[#e5e7eb] px-4 py-3 text-center text-[14px] font-semibold text-[#1f2937]">
                Total Línea
              </th>
            </tr>
          </thead>

          <tbody>
            {items.map((item) => {
              const totalLinea = item.cantidad * item.precio;
              const esConfirmado = item.estadoItem === "confirmado";

              return (
                <tr key={item.codigo} className={`transition-colors ${esConfirmado ? 'bg-[#e8f7ec]/30' : 'hover:bg-[#fcfcfd]'}`}>
                  <td className="border-b border-r border-[#e5e7eb] px-4 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      {!esConfirmado ? (
                        <>
                          {editandoCodigo === item.codigo ? (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  onActualizarPrecio(item.codigo, precioTemporal);
                                  setEditandoCodigo(null);
                                }}
                                className="text-emerald-600 hover:text-emerald-700"
                                title="Guardar precio"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditandoCodigo(null)}
                                className="text-red-600 hover:text-red-700"
                                title="Cancelar"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setEditandoCodigo(item.codigo);
                                setPrecioTemporal(item.precio);
                              }}
                              className="text-[#94a3b8] hover:text-[#64748b]"
                              title="Editar precio"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => onEliminarItem(item.codigo)}
                            className="text-[#94a3b8] hover:text-[#64748b]"
                            title="Eliminar ítem"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-[#e8f7ec] text-[#22814a]">
                          <Check className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                  </td>

                  <td className="border-b border-r border-[#e5e7eb] px-4 py-4 text-[15px] font-medium text-[#1f2937]">
                    {item.codigo}
                  </td>

                  <td className="border-b border-r border-[#e5e7eb] px-4 py-4 text-[15px] text-[#1f2937]">
                    <div>
                      <p>{item.descripcion}</p>
                      {item.marca && (
                        <p className="mt-1 text-[13px] text-[#94a3b8]">
                          Marca: {item.marca}
                        </p>
                      )}
                      {esConfirmado && (
                        <span className="mt-1 inline-flex rounded-full bg-[#e8f7ec] px-2 py-0.5 text-[10px] font-bold text-[#22814a] border border-[#b8e6c4]">
                          CONFIRMADO
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="border-b border-r border-[#e5e7eb] px-4 py-4 text-center">
                    <div className="flex items-center justify-center">
                      <input
                        type="number"
                        min={1}
                        value={item.cantidad}
                        disabled={esConfirmado}
                        onChange={(e) =>
                          manejarCambioCantidad(item.codigo, e.target.value)
                        }
                        onBlur={(e) =>
                          manejarCambioCantidad(item.codigo, e.target.value)
                        }
                        className={`h-10 w-20 rounded-xl border border-[#d7dce5] text-center text-[14px] outline-none ${esConfirmado ? 'bg-slate-50 text-slate-500 cursor-not-allowed border-slate-200' : ''}`}
                      />
                    </div>
                  </td>

                  <td className="border-b border-r border-[#e5e7eb] px-4 py-4 text-center text-[15px] font-semibold text-[#4b5563]">
                    {editandoCodigo === item.codigo ? (
                      <div className="relative inline-block">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                        <input
                          type="number"
                          value={precioTemporal}
                          onChange={(e) => setPrecioTemporal(parseFloat(e.target.value) || 0)}
                          className="h-9 w-28 rounded-lg border border-blue-200 pl-4 pr-1 text-center text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              onActualizarPrecio(item.codigo, precioTemporal);
                              setEditandoCodigo(null);
                            }
                            if (e.key === 'Escape') setEditandoCodigo(null);
                          }}
                        />
                      </div>
                    ) : (
                      <span className={esConfirmado ? 'text-slate-500' : ''}>
                        {formatearMoneda(item.precio)}
                      </span>
                    )}
                  </td>

                  <td className="border-b border-r border-[#e5e7eb] px-4 py-4 text-center text-[15px] text-[#1f2937]">
                    {item.stock}
                  </td>

                  <td className="border-b border-r border-[#e5e7eb] px-4 py-4 text-center text-[15px] text-[#1f2937]">
                    {item.ubicacion}
                  </td>

                  <td className="border-b border-[#e5e7eb] px-4 py-4 text-center text-[15px] font-semibold text-[#243047]">
                    {formatearMoneda(totalLinea)}
                  </td>
                </tr>
              );
            })}

            {items.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-6 py-10 text-center text-[14px] text-[#6b7280]"
                >
                  Todavía no agregaste repuestos al presupuesto.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="border-t border-[#e5e7eb] px-5 py-4">
        <div className="mb-3 flex items-center justify-between gap-4">
          <label className="block text-[15px] font-medium text-[#6b7280]">
            Observaciones
          </label>

          <div className="flex flex-col items-end rounded-2xl bg-[#f8fafc] px-6 py-3">
            <span className="text-[12px] font-bold uppercase tracking-wider text-[#64748b]">Total</span>
            <span className="text-[26px] font-black text-[#243047] leading-tight">
              {formatearMoneda(total)}
            </span>
          </div>
        </div>

        <textarea
          value={observaciones}
          onChange={(e) => onChangeObservaciones(e.target.value)}
          className="min-h-[88px] w-full resize-none rounded-2xl border border-[#e5e7eb] bg-[#fafafa] p-4 text-[14px] text-[#334155] outline-none placeholder:text-[#9ca3af]"
          placeholder="Agregá una observación interna para este presupuesto..."
        />
      </div>
    </section>
  );
}
