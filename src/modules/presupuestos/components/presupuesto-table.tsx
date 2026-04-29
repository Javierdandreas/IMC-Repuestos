"use client";

import { Eye, MoreVertical, CircleCheckBig, RefreshCcw } from "lucide-react";
import { formatearFecha, formatearMoneda, estadoTextoDesdeRaw, estadoDepositoTexto } from "../utils/presupuestos-utils";
import type { PresupuestoCompleto } from "../types/presupuesto";

type Props = {
  pagedRows: PresupuestoCompleto[];
  status: "confirmados" | "pendientes" | "general";
  loading: boolean;
  isProcessing: boolean;
  theme: any;
  onConfirmar: (row: PresupuestoCompleto) => void;
  onAbrirDetalle: (row: PresupuestoCompleto) => void;
  onToggleMenu: (row: PresupuestoCompleto, event: React.MouseEvent<HTMLButtonElement>) => void;
  getRowBackground: (estadoDeposito?: string) => string;
};

export function PresupuestoTable({
  pagedRows,
  status,
  loading,
  isProcessing,
  theme,
  onConfirmar,
  onAbrirDetalle,
  onToggleMenu,
  getRowBackground,
}: Props) {
  return (
    <section className="overflow-visible rounded-[24px] border border-[#eceef2] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="bg-[#fbfbfc] text-left">
              {status === "pendientes" && (
                <th className="w-[92px] px-3 py-4 text-center text-[13px] font-semibold text-[#243047]">
                  Confirmar
                </th>
              )}

              <th className="w-[76px] px-2 py-4 text-[12px] font-semibold text-[#243047]">
                Código OP
              </th>
              <th className="w-[118px] px-2 py-4 text-[12px] font-semibold text-[#243047]">
                Fecha
              </th>
              <th className="px-3 py-4 text-[13px] font-semibold text-[#243047]">
                Cliente
              </th>
              <th className="px-3 py-4 text-[13px] font-semibold text-[#243047]">
                Marca
              </th>
              <th className="px-3 py-4 text-[13px] font-semibold text-[#243047]">
                Modelo
              </th>
              <th className="px-3 py-4 text-[13px] font-semibold text-[#243047]">
                Patente
              </th>
              <th className="px-3 py-4 text-[13px] font-semibold text-[#243047]">
                Total
              </th>
              <th className="px-3 py-4 text-[13px] font-semibold text-[#243047]">
                Estado
              </th>
              {status === "confirmados" && (
                <th className="px-3 py-4 text-[13px] font-semibold text-[#243047]">
                  Preparación
                </th>
              )}
              <th className="w-[62px] px-2 py-4 text-center text-[12px] font-semibold text-[#243047]">
                Detalle
              </th>
              <th className="w-[72px] px-2 py-4 text-center text-[12px] font-semibold text-[#243047]">
                Acciones
              </th>
            </tr>
          </thead>

          <tbody>
            {pagedRows.map((row) => {
              return (
                <tr
                  key={row.id}
                  className={`${getRowBackground(row.estadoDeposito)} border-t border-[#eef2f7] transition-colors`}
                >
                  {status === "pendientes" && (
                    <td className="px-3 py-4 text-center">
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => onConfirmar(row)}
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#d8e6d8] bg-[#f5fcf6] text-[#3f8f58] hover:bg-[#eef8f0] transition-all ${isProcessing ? "opacity-40 cursor-wait" : ""}`}
                        title="Confirmar"
                      >
                        <CircleCheckBig className="h-4 w-4" />
                      </button>
                    </td>
                  )}

                  <td className="px-2 py-4 text-[12px] font-semibold text-[#243047]">
                    {row.codigo}
                  </td>
                  <td className="px-2 py-4 text-[12px] text-[#475569]">
                    {formatearFecha(row.fecha)}
                  </td>
                  <td className="px-3 py-4 text-[13px] text-[#243047]">
                    {row.cliente || "-"}
                  </td>
                  <td className="px-3 py-4 text-[13px] text-[#475569]">
                    {row.marca || ""}
                  </td>
                  <td className="px-3 py-4 text-[13px] text-[#475569]">
                    {row.modelo || "-"}
                  </td>
                  <td className="px-3 py-4 text-[13px] text-[#475569]">
                    {row.patente || "-"}
                  </td>
                  <td className="px-3 py-4 text-[13px] font-semibold text-[#243047]">
                    {formatearMoneda(row.total)}
                  </td>
                  <td className="px-3 py-4">
                    {(() => {
                      const estadoLabel = estadoTextoDesdeRaw(row.estado, row.items);
                      const badgeClass = estadoLabel === "Parcial"
                        ? "bg-[#fff2cc] text-[#9a6b00]"
                        : estadoLabel === "Cerrado"
                          ? "bg-[#f1f5f9] text-[#475569]"
                          : estadoLabel === "Confirmado"
                            ? "bg-[#e8f7ec] text-[#22814a]"
                            : theme.estadoBadge;
                      return (
                        <span className={`inline-flex rounded-full px-3 py-1 text-[12px] font-semibold ${badgeClass}`}>
                          {estadoLabel}
                        </span>
                      );
                    })()}
                  </td>

                  {status === "confirmados" && (
                    <td className="px-3 py-4">
                      <div className="flex flex-col items-center gap-1">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-[12px] font-semibold ${row.estadoDeposito === "separado"
                            ? "bg-[#e8f7ec] text-[#22814a]"
                            : row.estadoDeposito === "con_faltante"
                              ? "bg-[#fff2cc] text-[#9a6b00]"
                              : row.estadoDeposito === "en_preparacion"
                                ? "bg-[#e8f0ff] text-[#3f62a8]"
                                : "bg-[#f1f5f9] text-[#64748b]"
                            }`}
                        >
                          {estadoDepositoTexto(row.estadoDeposito)}
                        </span>
                        {row.estadoDeposito === "en_preparacion" && row.separadorNombre && (
                          <span className="text-[10px] font-bold text-[#3f62a8] uppercase">
                            ({row.separadorNombre})
                          </span>
                        )}
                      </div>
                    </td>
                  )}

                  <td className="px-2 py-4 text-center">
                    <button
                      type="button"
                      onClick={() => onAbrirDetalle(row)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#e5e7eb] bg-white text-[#64748b] hover:bg-[#f8fafc]"
                      title="Ver detalle"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>

                  <td className="px-2 py-4 text-center">
                    <button
                      type="button"
                      onClick={(event) => onToggleMenu(row, event)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#e5e7eb] bg-white text-[#64748b] hover:bg-[#f8fafc]"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}

            {!loading && pagedRows.length < 6 && (
              <>
                {pagedRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={status === "general" ? 10 : 11}
                      className="px-6 py-10 text-center text-[14px] text-[#6b7280]"
                    >
                      No hay presupuestos para mostrar.
                    </td>
                  </tr>
                )}
                {Array.from({ length: 6 - (pagedRows.length || 1) }).map((_, idx) => (
                  <tr key={`empty-${idx}`} className="border-t border-[#eef2f7]">
                    <td className="px-3 py-[26px]" colSpan={status === "general" ? 10 : 11}>
                      &nbsp;
                    </td>
                  </tr>
                ))}
              </>
            )}

            {loading && (
              <tr>
                <td
                  colSpan={status === "general" ? 10 : 11}
                  className="px-6 py-10 text-center text-[14px] text-[#6b7280]"
                >
                  <RefreshCcw className="mx-auto mb-2 h-6 w-6 animate-spin text-[#9ca3af]" />
                  Sincronizando con la nube...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

