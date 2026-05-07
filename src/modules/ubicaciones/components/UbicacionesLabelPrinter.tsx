"use client";

import { useEffect, useState, useCallback } from "react";
import { Modal } from "@/components/ui/Modal";
import type { Ubicacion } from "@/modules/ubicaciones/types/ubicaciones";
import Barcode from "react-barcode";
import { toast } from "sonner";
import { HiPrinter } from "react-icons/hi";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  labelsToPrint: Ubicacion[];
  onSuccess?: () => void;
}

export function UbicacionesLabelPrinter({ isOpen, onClose, labelsToPrint, onSuccess }: Props) {
  const [readyToPrint, setReadyToPrint] = useState(false);

  const handlePrint = useCallback(() => {
    const sourceHtml = document.getElementById("ubicaciones-print-source")?.innerHTML;
    
    if (!sourceHtml) {
      toast.error("Error al preparar las etiquetas.");
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Por favor, permite las ventanas emergentes para imprimir.");
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Imprimir Ubicaciones</title>
          <style>
            @page { 
              size: A4;
              margin: 10mm;
            }
            body { 
              margin: 0; 
              padding: 0; 
              background: white;
              font-family: sans-serif;
            }
            .grid-container {
              display: grid;
              grid-template-columns: 1fr;
              gap: 15mm;
            }
            .label-card {
              width: 100%;
              min-height: 85mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              page-break-inside: avoid;
              overflow: hidden;
              box-sizing: border-box;
              padding: 5mm;
              text-align: center;
            }
            svg {
              width: 100% !important;
              height: auto !important;
              max-height: 30mm !important;
              margin-bottom: 5mm;
            }
            .label-detail-row {
              width: 100%;
              display: flex;
              flex-direction: column;
              align-items: center;
            }
            .label-detail-text { 
              font-size: 32mm; 
              font-weight: 900; 
              margin: 0;
              line-height: 0.9;
              text-transform: uppercase;
              letter-spacing: -1.5pt;
              color: #000;
            }
          </style>
        </head>
        <body>
          <div class="grid-container">
            ${sourceHtml}
          </div>
          <script>
            window.onload = function() {
              setTimeout(() => {
                window.print();
                window.close();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    
    if (onSuccess) onSuccess();
    onClose();
  }, [onClose, onSuccess]);

  useEffect(() => {
    if (readyToPrint) {
      handlePrint();
      setReadyToPrint(false);
    }
  }, [readyToPrint, handlePrint]);

  return (
    <Modal open={isOpen} onClose={onClose} title="Impresión de Ubicaciones" width="w-[min(92vw,1000px)]">
      <div className="flex flex-col gap-6">
        {/* Source for Printing (Hidden) */}
        <div id="ubicaciones-print-source" className="hidden">
           {labelsToPrint.map((label, idx) => {
             const hasBarcode = !!(label.codigo_barra || label.codigo);
             const barcodeValue = label.codigo_barra || (label.codigo ? `UBI:${label.codigo}` : "");
             
             return (
               <div key={`source-${label.id}-${idx}`} className="label-card">
                 {hasBarcode && (
                   <Barcode 
                     value={barcodeValue} 
                     width={3} 
                     height={90} 
                     displayValue={false}
                     margin={0}
                   />
                 )}
                 <div className="label-detail-row">
                   <span className="label-detail-text">{label.codigo || label.descripcion}</span>
                 </div>
               </div>
             );
           })}
        </div>

        {/* Panel de Control */}
        <div className="flex items-center justify-between p-5 rounded-3xl bg-slate-50 border border-slate-200 dark:bg-slate-900/50 dark:border-slate-800">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-blue-500 text-white shadow-xl shadow-blue-500/20">
              <HiPrinter className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tight">
                {labelsToPrint.length} Ubicaciones listas
              </h3>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                Formato térmico 50x25mm
              </p>
            </div>
          </div>

          <button
            onClick={() => setReadyToPrint(true)}
            disabled={labelsToPrint.length === 0}
            className="flex items-center gap-3 px-8 py-3 bg-blue-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-blue-600/30 hover:bg-blue-500 hover:-translate-y-0.5 transition-all active:translate-y-0 disabled:opacity-50"
          >
            CONFIRMAR E IMPRIMIR
          </button>
        </div>

        {/* Grid de Previsualización (Minimalista) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[45vh] overflow-y-auto p-4 bg-white dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-inner">
          {labelsToPrint.map((label) => {
             const hasBarcode = !!(label.codigo_barra || label.codigo);
             const barcodeValue = label.codigo_barra || (label.codigo ? `UBI:${label.codigo}` : "");

             return (
              <div 
                key={`preview-${label.id}`}
                className="group relative flex flex-col items-center p-5 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 transition hover:border-blue-500/50 hover:bg-white dark:hover:bg-slate-800"
              >
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-tighter mb-2">
                  {label.sector_codigo ? `Sector ${label.sector_codigo}` : "Ubicación Legacy"}
                </span>
                
                <div className="bg-white p-2 rounded-lg border border-slate-200 mb-3 w-full flex justify-center overflow-hidden opacity-80 group-hover:opacity-100 transition-opacity">
                  {hasBarcode ? (
                    <Barcode 
                      value={barcodeValue} 
                      width={1.2} 
                      height={35} 
                      displayValue={false}
                      fontSize={10}
                      background="#ffffff"
                      lineColor="#000000"
                    />
                  ) : (
                    <div className="h-[35px] flex items-center text-[10px] text-slate-400 font-black tracking-widest uppercase">
                      Sin Código
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-center gap-1">
                  <span className="text-[14px] font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                    {label.codigo || label.descripcion}
                  </span>
                </div>
              </div>
            );
          })}
          
          {labelsToPrint.length === 0 && (
            <div className="col-span-full py-20 text-center">
              <p className="text-slate-400 font-bold uppercase tracking-widest">No hay ubicaciones seleccionadas</p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
