"use client";

import { createPortal } from "react-dom";
import { X, ChevronUp, ChevronDown, CheckCircle2, Check, PackageCheck, Plus, Eye, Pencil, Copy, RefreshCcw, Undo2, Trash2, TriangleAlert, Download } from "lucide-react";
import { formatearFecha, formatearMoneda, getDetalleRowBackground } from "../utils/presupuestos-utils";
import type { PresupuestoCompleto, PresupuestoItem } from "../types/presupuesto";

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#e5e7eb] bg-[#fafafa] px-2.5 py-2">
      <p className="text-[10px] font-medium text-[#6b7280]">{label}</p>
      <p className="mt-0.5 break-words text-[12px] leading-tight text-[#243047]">
        {value || "-"}
      </p>
    </div>
  );
}

type Props = {
  // Estados de Modales
  detalleAbierto: boolean;
  rowSeleccionada: PresupuestoCompleto | null;
  modoDetalle: "view" | "confirm";
  status: "confirmados" | "pendientes" | "general";
  checkedItems: string[];
  mostrarDetalleInfo: boolean;
  detailPageSafe: number;
  detailItems: PresupuestoItem[];
  detailTotalPages: number;
  isProcessing: boolean;

  // Estados de Duplicar
  duplicarAbierto: boolean;
  rowParaDuplicar: PresupuestoCompleto | null;

  // Estados de Diálogo
  dialogAction: any;

  // Toasts
  permissionToast: string | null;
  successToast: string | null;

  // Menú de Acciones
  menuAbiertoId: string | null;
  rowParaMenu: PresupuestoCompleto | null;
  menuPosition: { top: number; left: number } | null;
  menuDirection: "up" | "down";
  puedeOperarVendedor: boolean;

  // Handlers
  onCerrarDetalle: () => void;
  setMostrarDetalleInfo: (val: boolean) => void;
  setDetailPage: (val: number) => void;
  toggleCheckedItem: (id: string) => void;
  onAgregarItemsAExistente: () => void;
  onGuardarConfirmacionVendedor: () => void;
  onGuardarDetalleDeposito: () => void;
  onMarcarPresupuestoSeparado: () => void;
  onConfirmarDuplicar: (conservar: boolean) => void;
  setDuplicarAbierto: (val: boolean) => void;
  onCerrarDialogo: () => void;
  onConfirmarDialogo: () => void;
  onAbrirDetalle: (row: PresupuestoCompleto) => void;
  onEditarPresupuesto: (row: PresupuestoCompleto) => void;
  onAbrirDuplicar: (row: PresupuestoCompleto) => void;
  onRecotizar: (row: PresupuestoCompleto) => void;
  onExportarPDF: (row: PresupuestoCompleto) => void;
  onVolverAPendiente: (row: PresupuestoCompleto) => void;
  onEliminarFila: (row: PresupuestoCompleto) => void;
  setMenuAbiertoId: (id: string | null) => void;
  menuRef: any;
};

export function PresupuestoModalsManager({
  detalleAbierto,
  rowSeleccionada,
  modoDetalle,
  status,
  checkedItems,
  mostrarDetalleInfo,
  detailPageSafe,
  detailItems,
  detailTotalPages,
  isProcessing,
  duplicarAbierto,
  rowParaDuplicar,
  dialogAction,
  permissionToast,
  successToast,
  menuAbiertoId,
  rowParaMenu,
  menuPosition,
  menuDirection,
  puedeOperarVendedor,
  onCerrarDetalle,
  setMostrarDetalleInfo,
  setDetailPage,
  toggleCheckedItem,
  onAgregarItemsAExistente,
  onGuardarConfirmacionVendedor,
  onGuardarDetalleDeposito,
  onMarcarPresupuestoSeparado,
  onConfirmarDuplicar,
  setDuplicarAbierto,
  onCerrarDialogo,
  onConfirmarDialogo,
  onAbrirDetalle,
  onEditarPresupuesto,
  onAbrirDuplicar,
  onRecotizar,
  onExportarPDF,
  onVolverAPendiente,
  onEliminarFila,
  setMenuAbiertoId,
  menuRef,
}: Props) {
  if (typeof document === "undefined") return null;

  const confirmButtonClass =
    dialogAction.open && dialogAction.confirmVariant === "danger"
      ? "bg-[#b34747] text-white"
      : dialogAction.open && dialogAction.confirmVariant === "warning"
        ? "bg-[#c27c17] text-white"
        : "bg-[#1248a8] text-white";

  return (
    <>
      {/* Modal de Detalle */}
      {detalleAbierto && rowSeleccionada && createPortal(
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-0 sm:p-2 backdrop-blur-sm"
          onClick={onCerrarDetalle}
        >
          <div
            className="w-full sm:w-[94vw] max-w-[1200px] rounded-none sm:rounded-[28px] bg-white shadow-2xl flex flex-col h-[100dvh] sm:h-[92vh] animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#eef2f7] px-4 py-2 mt-1 sm:mt-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8aa8d8]">
                  Detalle del presupuesto
                </p>
                <h2 className="mt-1 text-[16px] font-bold text-[#243047]">
                  {rowSeleccionada.codigo}
                </h2>
              </div>

              <button
                type="button"
                onClick={onCerrarDetalle}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#e5e7eb] text-[#64748b] hover:bg-slate-50 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-1 flex-col space-y-2 px-4 py-3 overflow-y-auto">
              <div
                className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-1.5 cursor-pointer border border-[#eef2f7] hover:bg-slate-100 transition-colors"
                onClick={() => setMostrarDetalleInfo(!mostrarDetalleInfo)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold text-[#475569]">Datos del Cliente y Vehículo</span>
                  {!mostrarDetalleInfo && (
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="text-[11px] text-[#64748b] font-medium hidden sm:inline-block truncate">
                        — {rowSeleccionada.cliente || "Sin cliente"} ({rowSeleccionada.marca || "-"} {rowSeleccionada.modelo || "-"})
                      </span>
                      <span className="text-[11px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-bold whitespace-nowrap border border-blue-100">
                        Vendedor: {rowSeleccionada.vendedorNombre || "Sistema"}
                      </span>
                      {rowSeleccionada.separadorNombre && (
                        <span className="text-[11px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md font-bold whitespace-nowrap border border-emerald-100">
                          Depósito: {rowSeleccionada.separadorNombre}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <button type="button" className="text-[#64748b]">
                  {mostrarDetalleInfo ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>

              {mostrarDetalleInfo && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <Info label="Cliente" value={rowSeleccionada.cliente} />
                  <Info label="Teléfono" value={rowSeleccionada.telefono} />
                  <Info label="DNI / CUIT" value={rowSeleccionada.referencia} />
                  <Info label="Marca" value={rowSeleccionada.marca} />
                  <Info label="Modelo" value={rowSeleccionada.modelo} />
                  <Info label="Chasis" value={rowSeleccionada.chasis} />
                  <Info label="Patente" value={rowSeleccionada.patente} />
                  <Info label="Fecha" value={formatearFecha(rowSeleccionada.fecha)} />
                </div>
              )}

              <div className="flex-1 overflow-hidden rounded-2xl border border-[#e5e7eb]">
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse">
                    <thead>
                      <tr className="bg-[#fbfbfc]">
                        {status !== "general" && (status !== "pendientes" || modoDetalle === "confirm") && (
                          <th className="w-[54px] px-2 py-1.5 text-center text-[11px] font-semibold text-[#1f2937]">
                            Check
                          </th>
                        )}
                        <th className="px-2 py-1.5 text-left text-[11px] font-semibold text-[#1f2937]">
                          Código
                        </th>
                        <th className="px-2 py-1.5 text-left text-[11px] font-semibold text-[#1f2937]">
                          Descripción
                        </th>
                        <th className="w-[60px] px-2 py-1.5 text-center text-[11px] font-semibold text-[#1f2937]">
                          Cant.
                        </th>
                        <th className="w-[76px] px-2 py-1.5 text-center text-[11px] font-semibold text-[#1f2937]">
                          Ubicación
                        </th>
                        <th className="w-[92px] px-2 py-1.5 text-center text-[11px] font-semibold text-[#1f2937]">
                          Estado
                        </th>
                        <th className="w-[84px] px-2 py-1.5 text-right text-[11px] font-semibold text-[#1f2937]">
                          Precio
                        </th>
                        <th className="w-[92px] px-2 py-1.5 text-right text-[11px] font-semibold text-[#1f2937]">
                          Total
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {detailItems.map((item) => {
                        const itemId = item.id || item.codigo;
                        const checked = checkedItems.includes(itemId);

                        return (
                          <tr
                            key={`${rowSeleccionada.id}-${itemId}`}
                            className={`${status === "confirmados"
                              ? getDetalleRowBackground(itemId, status, checkedItems, item.estadoDepositoItem)
                              : item.estadoItem === "confirmado" ? "bg-[#e8f7ec]/40" : "bg-[#fff2cc]/20"
                              } border-t border-[#eef2f7] transition-colors`}
                          >
                            {status !== "general" && (status !== "pendientes" || modoDetalle === "confirm") && (
                              <td className="px-2 py-1.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={status === "pendientes" && item.estadoItem === "confirmado"}
                                  onChange={() => toggleCheckedItem(itemId)}
                                  className={`h-3.5 w-3.5 rounded accent-[#0d4aa5] ${(status === "pendientes" && item.estadoItem === "confirmado") ? "opacity-30" : ""}`}
                                />
                              </td>
                            )}
                            <td className="px-2 py-1.5 text-[11px] font-medium text-[#334155]">
                              {item.codigo}
                            </td>
                            <td className="px-2 py-1.5 text-[11px] leading-tight text-[#334155]">
                              <div className="flex flex-col">
                                <span>{item.descripcion}</span>
                                {item.codigoEnvio && (
                                  <span className="mt-0.5 text-[9px] font-bold text-[#1a5b32]">
                                    Enviado en: {item.codigoEnvio}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-2 py-1.5 text-center text-[11px] text-[#334155]">
                              {item.cantidad}
                            </td>
                            <td className="px-2 py-1.5 text-center text-[11px] text-[#334155]">
                              {item.ubicacion || "-"}
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              {status === "confirmados" ? (
                                item.estadoDepositoItem === "separado" ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-[#e8f7ec] px-2 py-0.5 text-[9px] font-bold text-[#22814a] border border-[#b8e6c4]">
                                    <CheckCircle2 className="h-2.5 w-2.5" />
                                    Separado
                                  </span>
                                ) : item.estadoDepositoItem === "no_encontrado" ? (
                                  <span className="inline-flex rounded-full bg-[#fff1f2] px-2 py-0.5 text-[9px] font-bold text-[#e11d48] border border-[#fecdd3]">
                                    No encont.
                                  </span>
                                ) : (
                                  <span className="inline-flex rounded-full bg-[#f1f5f9] px-2 py-0.5 text-[9px] font-medium text-[#64748b] border border-[#e2e8f0]">
                                    Pendiente
                                  </span>
                                )
                              ) : (
                                item.estadoItem === "confirmado" ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-[#e8f7ec] px-2 py-0.5 text-[9px] font-bold text-[#22814a] border border-[#b8e6c4]">
                                    <CheckCircle2 className="h-2.5 w-2.5" />
                                    Confirmado
                                  </span>
                                ) : (
                                  <span className="inline-flex rounded-full bg-[#fff2cc] px-2 py-0.5 text-[9px] font-medium text-[#9a6b00] border border-[#fce8a8]">
                                    Pendiente
                                  </span>
                                )
                              )}
                            </td>
                            <td className="px-2 py-1.5 text-right text-[11px] text-[#334155]">
                              {formatearMoneda(item.precio)}
                            </td>
                            <td className="px-2 py-1.5 text-right text-[11px] font-semibold text-[#243047]">
                              {formatearMoneda(item.precio * item.cantidad)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {detailTotalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  {Array.from({ length: detailTotalPages }, (_, i) => i + 1).map(
                    (page) => (
                      <button
                        key={page}
                        type="button"
                        onClick={() => setDetailPage(page)}
                        className={`h-7 min-w-7 rounded-xl px-2.5 text-[11px] font-semibold ${page === detailPageSafe
                          ? "bg-[#0d4aa5] text-white"
                          : "border border-[#e5e7eb] bg-white text-[#475569]"
                          }`}
                      >
                        {page}
                      </button>
                    )
                  )}
                </div>
              )}

              <div className="rounded-xl border border-[#eef2f7] bg-[#fafafa] p-2">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-medium text-[#6b7280]">Observaciones</p>
                    <p className="mt-0.5 text-[11px] text-[#243047]">{rowSeleccionada.observaciones || "-"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-medium text-[#6b7280]">Total</p>
                    <p className="text-[15px] font-bold text-[#243047]">{formatearMoneda(rowSeleccionada.total)}</p>
                  </div>
                </div>
              </div>

              {status === "pendientes" && modoDetalle === "confirm" && (
                <div className="flex flex-col gap-2 border-t border-[#eef2f7] pt-3 sm:flex-row sm:justify-between">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={onAgregarItemsAExistente}
                      className="flex h-[40px] sm:h-[36px] items-center justify-center gap-2 rounded-[14px] bg-[#eaf2ff] px-5 text-[14px] sm:text-[12px] font-semibold text-[#1248a8] shadow-sm transition-all hover:bg-[#d5e4ff]"
                    >
                      <Plus className="h-4 w-4" />
                      Agregar ítems
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={isProcessing || checkedItems.length === 0}
                    onClick={onGuardarConfirmacionVendedor}
                    className={`flex h-[40px] sm:h-[36px] items-center justify-center gap-2 rounded-[14px] bg-[#1248a8] px-6 text-[14px] sm:text-[12px] font-semibold text-white shadow-md transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed ${isProcessing ? "cursor-wait" : ""}`}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {isProcessing ? "Confirmando..." : `Confirmar selección (${checkedItems.length})`}
                  </button>
                </div>
              )}

              {status === "confirmados" && (
                <div className="flex flex-col gap-2 border-t border-[#eef2f7] pt-2 sm:flex-row sm:justify-between">
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={onGuardarDetalleDeposito}
                    className={`flex w-full sm:w-auto h-[40px] sm:h-[36px] items-center justify-center gap-2 rounded-[14px] bg-[#f3c86b] px-5 text-[14px] sm:text-[12px] font-semibold text-[#5b4300] shadow-sm transition-all hover:opacity-95 ${isProcessing ? "opacity-50 cursor-wait" : ""}`}
                  >
                    <Check className="h-5 w-5 sm:h-4 sm:w-4" />
                    {isProcessing ? "Guardando..." : "Guardar"}
                  </button>

                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={onMarcarPresupuestoSeparado}
                    className={`flex w-full sm:w-auto h-[40px] sm:h-[36px] items-center justify-center gap-2 rounded-[14px] bg-[#67c587] px-5 text-[14px] sm:text-[12px] font-semibold text-white shadow-sm transition-all hover:opacity-95 ${isProcessing ? "opacity-50 cursor-wait" : ""}`}
                  >
                    <PackageCheck className="h-5 w-5 sm:h-4 sm:w-4" />
                    {isProcessing ? "Procesando..." : "Presupuesto separado"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal de Duplicar */}
      {duplicarAbierto && rowParaDuplicar && createPortal(
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setDuplicarAbierto(false)}
        >
          <div
            className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[22px] font-bold text-[#243047]">Duplicar presupuesto</h3>
            <p className="mt-2 text-[14px] text-[#64748b]">
              ¿Querés conservar los datos del cliente y vehículo al duplicar {rowParaDuplicar.codigo}?
            </p>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => onConfirmarDuplicar(true)}
                className="rounded-2xl bg-[#1248a8] px-4 py-3 text-[14px] font-semibold text-white hover:opacity-90 transition-opacity"
              >
                Sí, conservar datos
              </button>

              <button
                type="button"
                onClick={() => onConfirmarDuplicar(false)}
                className="rounded-2xl border border-[#e5e7eb] bg-white px-4 py-3 text-[14px] font-semibold text-[#243047] hover:bg-slate-50 transition-colors"
              >
                No, empezar vacío
              </button>
            </div>

            <button
              type="button"
              onClick={() => setDuplicarAbierto(false)}
              className="mt-4 w-full rounded-2xl border border-[#e5e7eb] bg-[#f8fafc] px-4 py-3 text-[14px] font-medium text-[#475569] hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Diálogo de Confirmación */}
      {dialogAction.open && createPortal(
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={onCerrarDialogo}
        >
          <div
            className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[22px] font-bold text-[#243047]">{dialogAction.title}</h3>
            <p className="mt-2 text-[14px] text-[#64748b]">{dialogAction.description}</p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onCerrarDialogo}
                className="rounded-2xl border border-[#e5e7eb] bg-white px-4 py-3 text-[14px] font-semibold text-[#243047] hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={onConfirmarDialogo}
                className={`rounded-2xl px-4 py-3 text-[14px] font-semibold transition-opacity hover:opacity-90 ${confirmButtonClass}`}
              >
                {dialogAction.confirmText}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Toasts */}
      {permissionToast && createPortal(
        <div className="fixed bottom-5 right-5 z-[90] flex items-center gap-3 rounded-2xl border border-[#f4d6d6] bg-white px-4 py-3 shadow-lg animate-in slide-in-from-right duration-300">
          <TriangleAlert className="h-5 w-5 text-[#b54747]" />
          <span className="text-[14px] font-medium text-[#7a2e2e]">{permissionToast}</span>
        </div>,
        document.body
      )}

      {successToast && createPortal(
        <div className="fixed bottom-5 right-5 z-[91] rounded-2xl bg-[#57b970] px-5 py-3 text-[14px] font-semibold text-white shadow-lg animate-in slide-in-from-right duration-300">
          {successToast}
        </div>,
        document.body
      )}

      {/* Menú Maestro de Acciones */}
      {menuAbiertoId && rowParaMenu && menuPosition && createPortal(
        <div
          ref={menuRef}
          className={`fixed z-[100] min-w-[220px] overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white text-left shadow-xl animate-in fade-in zoom-in duration-200 ${menuDirection === "up" ? "-translate-y-full -mt-2" : "mt-2"
            }`}
          style={{
            top: menuPosition.top,
            left: menuPosition.left - 220,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              onAbrirDetalle(rowParaMenu);
              setMenuAbiertoId(null);
            }}
            className="flex w-full items-center gap-3 px-4 py-3 text-[14px] text-[#243047] transition hover:bg-[#eaf2ff] hover:text-[#173b7a]"
          >
            <Eye className="h-4 w-4" />
            Ver detalle
          </button>

          {puedeOperarVendedor && (
            <>
              <button
                type="button"
                onClick={() => {
                  onEditarPresupuesto(rowParaMenu);
                  setMenuAbiertoId(null);
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-[14px] text-[#243047] transition hover:bg-[#eaf2ff] hover:text-[#173b7a]"
              >
                <Pencil className="h-4 w-4" />
                Editar
              </button>

              <button
                type="button"
                onClick={() => {
                  onAbrirDuplicar(rowParaMenu);
                  setMenuAbiertoId(null);
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-[14px] text-[#243047] transition hover:bg-[#eaf2ff] hover:text-[#173b7a]"
              >
                <Copy className="h-4 w-4" />
                Duplicar
              </button>

              <button
                type="button"
                onClick={() => {
                  onRecotizar(rowParaMenu);
                  setMenuAbiertoId(null);
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-[14px] text-[#243047] transition hover:bg-[#eaf2ff] hover:text-[#173b7a]"
              >
                <RefreshCcw className="h-4 w-4" />
                Recotizar
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => {
              onExportarPDF(rowParaMenu);
              setMenuAbiertoId(null);
            }}
            className="flex w-full items-center gap-3 px-4 py-3 text-[14px] text-[#243047] transition hover:bg-[#eaf2ff] hover:text-[#173b7a]"
          >
            <Download className="h-4 w-4" />
            Exportar PDF
          </button>

          {puedeOperarVendedor && (
            <>
              {rowParaMenu.estado === "confirmado" && (
                <button
                  type="button"
                  onClick={() => {
                    onVolverAPendiente(rowParaMenu);
                    setMenuAbiertoId(null);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-[14px] text-[#8a6500] transition hover:bg-[#fff4cc] hover:text-[#7a5600]"
                >
                  <Undo2 className="h-4 w-4" />
                  Volver a pendiente
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  onEliminarFila(rowParaMenu);
                  setMenuAbiertoId(null);
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-[14px] text-[#c24141] transition hover:bg-[#ffe7e7] hover:text-[#9f2222]"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar
              </button>
            </>
          )}
        </div>,
        document.body
      )}
    </>
  );
}


