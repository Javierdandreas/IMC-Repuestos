"use client";

import { useEffect, useState, useMemo } from "react";
import { Modal } from "@/components/ui/Modal";
import { ProductoListado } from "@/interfaces/productos";
import { ProductoSerie } from "@/interfaces/series";
import Barcode from "react-barcode";
import { toast } from "sonner";
import { HiPrinter, HiRefresh, HiExclamation, HiCheckCircle } from "react-icons/hi";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  products: ProductoListado[];
  onSuccess: () => void;
}

export function BulkLabelPrinter({ isOpen, onClose, products, onSuccess }: Props) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFetchingSeries, setIsFetchingSeries] = useState(false);
  const [readyToPrint, setReadyToPrint] = useState(false);
  const [seriesMap, setSeriesMap] = useState<Record<number, ProductoSerie[]>>({});

  // Identificar productos sin barcode
  const missingBarcodes = products.filter(p => !p.cod_barra || p.cod_barra.trim() === "");

  // Cargar series para productos trazables
  useEffect(() => {
    const fetchSeries = async () => {
      const trazableIds = products
        .filter(p => p.usa_numero_serie)
        .map(p => p.id);

      if (trazableIds.length === 0) return;

      setIsFetchingSeries(true);
      try {
        const res = await fetch("/api/series/bulk-get", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productIds: trazableIds }),
        });
        const data = await res.json();
        if (data.success) {
          const map: Record<number, ProductoSerie[]> = {};
          data.series.forEach((s: ProductoSerie) => {
            if (!map[s.id_producto]) map[s.id_producto] = [];
            map[s.id_producto].push(s);
          });
          setSeriesMap(map);
        }
      } catch (error) {
        console.error("Error fetching series:", error);
        toast.error("Error al cargar los números de serie.");
      } finally {
        setIsFetchingSeries(false);
      }
    };

    if (isOpen) {
      fetchSeries();
    }
  }, [isOpen, products]);

  // Generar etiquetas individuales
  const labelsToPrint = useMemo(() => {
    const list: { product: ProductoListado; serial?: string }[] = [];
    
    products.forEach(p => {
      if (p.usa_numero_serie) {
        const series = seriesMap[p.id] || [];
        series.forEach(s => {
          list.push({ product: p, serial: s.numero_serie });
        });
      } else {
        // Ahora también expandimos por stock para items no serializados
        const stockCount = Math.max(1, Number(p.stock) || 1);
        for (let i = 0; i < stockCount; i++) {
          list.push({ product: p });
        }
      }
    });

    return list;
  }, [products, seriesMap]);

  const handleAutoGenerateMissing = async () => {
    const productsToFix = products.filter(p => 
      p.usa_numero_serie && (seriesMap[p.id]?.length || 0) < (p.stock || 0)
    );

    if (productsToFix.length === 0) return;

    setIsGenerating(true);
    try {
      const res = await fetch("/api/series/bulk-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds: productsToFix.map(p => p.id) }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Series generadas correctamente.");
        // Refetch series
        const trazableIds = products.filter(p => p.usa_numero_serie).map(p => p.id);
        const resSeries = await fetch("/api/series/bulk-get", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productIds: trazableIds }),
        });
        const dataSeries = await resSeries.json();
        if (dataSeries.success) {
          const map: Record<number, ProductoSerie[]> = {};
          dataSeries.series.forEach((s: ProductoSerie) => {
            if (!map[s.id_producto]) map[s.id_producto] = [];
            map[s.id_producto].push(s);
          });
          setSeriesMap(map);
        }
      }
    } catch (error) {
      toast.error("Error al generar series faltantes.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveBarcodesAndPrint = async () => {
    if (missingBarcodes.length > 0) {
      setIsGenerating(true);
      try {
        const updates = missingBarcodes.map(p => ({
          id: p.id,
          cod_barra: p.cod_unico
        }));

        const res = await fetch("/api/productos/bulk-generate-barcodes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updates }),
        });

        if (!res.ok) throw new Error("Error al guardar códigos");
        toast.success(`${updates.length} códigos de barras guardados.`);
        onSuccess();
      } catch (error) {
        toast.error("Error al guardar códigos.");
        setIsGenerating(false);
        return;
      }
    }
    
    setReadyToPrint(true);
    setIsGenerating(false);
  };

  const handlePrint = () => {
    const sourceHtml = document.getElementById("labels-print-source")?.innerHTML;
    
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
          <title>Imprimir Etiquetas</title>
          <style>
            @page { 
              size: 50mm 25mm; 
              margin: 0; 
            }
            body { 
              margin: 0; 
              padding: 0; 
              background: white;
            }
            .label-card {
              width: 50mm;
              height: 25mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: space-between;
              page-break-after: always;
              page-break-inside: avoid;
              overflow: hidden;
              box-sizing: border-box;
              padding: 1mm 1mm;
              text-align: center;
              font-family: sans-serif;
            }
            svg {
              width: 100% !important;
              height: auto !important;
              max-height: 16mm !important;
            }
            .label-detail-row {
              width: 100%;
              display: flex;
              flex-direction: column;
              align-items: center;
              margin-top: 0.5mm;
            }
            .label-detail-text { 
              font-size: 7.5pt; 
              font-weight: bold; 
              margin: 0;
              line-height: 1;
            }
            .label-serial-badge {
              font-size: 7.5pt;
              font-weight: 900;
              border-top: 1px dashed #000;
              width: 100%;
              text-align: center;
              padding-top: 0.5mm;
              margin-top: 0.5mm;
              text-transform: uppercase;
              line-height: 1;
            }
          </style>
        </head>
        <body>
          ${sourceHtml}
          <script>
            window.onload = function() {
              setTimeout(() => {
                window.print();
                window.close();
              }, 300);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  useEffect(() => {
    if (readyToPrint) {
      handlePrint();
      setReadyToPrint(false);
    }
  }, [readyToPrint]);

  const hasMissingSeries = products.some(p => 
    p.usa_numero_serie && (seriesMap[p.id]?.length || 0) < (p.stock || 0)
  );

  return (
    <Modal open={isOpen} onClose={onClose} title="Impresión de Etiquetas" width="w-[min(92vw,1000px)]">
      <div className="flex flex-col gap-6">
        {/* Source for Printing (Hidden) */}
        <div id="labels-print-source" className="hidden">
           {labelsToPrint.map((label, idx) => (
              <div key={`source-${label.product.id}-${idx}`} className="label-card">
                <Barcode 
                  value={label.serial || label.product.cod_barra || label.product.cod_unico} 
                  width={1.5} 
                  height={40} 
                  fontSize={10}
                  margin={0}
                />
                <div className="label-detail-row">
                  <span className="label-detail-text">Código: {label.product.cod_unico}</span>
                  {label.serial && (
                    <span className="label-serial-badge">SERIE: {label.serial}</span>
                  )}
                </div>
              </div>
            ))}
        </div>

        {/* Panel de Control */}
        <div className="flex flex-col gap-4 p-5 rounded-3xl bg-slate-50 border border-slate-200 dark:bg-slate-900/50 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-blue-500 text-white shadow-xl shadow-blue-500/20">
                <HiPrinter className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  {labelsToPrint.length} Etiquetas listas
                </h3>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                  {isFetchingSeries ? "Cargando números de serie..." : "Formatos automáticos aplicados"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {hasMissingSeries && (
                <button
                  onClick={handleAutoGenerateMissing}
                  disabled={isGenerating}
                  className="flex items-center gap-2 px-5 py-3 bg-amber-500 text-white rounded-2xl font-black text-[11px] uppercase tracking-wider hover:bg-amber-400 transition-all disabled:opacity-50"
                >
                  <HiRefresh className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
                  Generar Series Faltantes
                </button>
              )}
              
              <button
                onClick={handleSaveBarcodesAndPrint}
                disabled={isGenerating || isFetchingSeries}
                className="flex items-center gap-3 px-8 py-3 bg-blue-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-blue-600/30 hover:bg-blue-500 hover:-translate-y-0.5 transition-all active:translate-y-0 disabled:opacity-50"
              >
                {isGenerating ? "PROCESANDO..." : "CONFIRMAR E IMPRIMIR"}
              </button>
            </div>
          </div>

          {missingBarcodes.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-xl border border-blue-100 text-[10px] font-bold dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400">
              <HiCheckCircle className="h-4 w-4" />
              {missingBarcodes.length} productos guardarán su código interno como código de barras.
            </div>
          )}
        </div>

        {/* Grid de Previsualización */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[55vh] overflow-y-auto p-4 bg-white dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 print:hidden">
          {labelsToPrint.map((label, idx) => (
            <div 
              key={`${label.product.id}-${label.serial || 'base'}-${idx}`}
              className="group relative flex flex-col items-center p-5 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 transition hover:border-blue-500/50 hover:bg-white dark:hover:bg-slate-800 overflow-hidden"
            >
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-tighter mb-1">
                {label.product.marca || "IMC REPUSTOS"}
              </span>
              <span className="text-[11px] font-black text-slate-900 dark:text-white text-center leading-tight mb-3 px-2 truncate w-full">
                {label.product.descripcion}
              </span>
              
              <div className="bg-white p-2 rounded-lg border border-slate-200 mb-2 w-full flex justify-center overflow-hidden">
                <Barcode 
                  value={label.serial || label.product.cod_barra || label.product.cod_unico} 
                  width={1.2} 
                  height={40} 
                  fontSize={10}
                  background="#ffffff"
                  lineColor="#000000"
                />
              </div>

              <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                Código: {label.product.cod_unico}
              </div>

              {label.serial && (
                <div className="mt-1 flex items-center gap-1 bg-blue-500 text-white px-2 py-0.5 rounded-full text-[9px] font-black tracking-widest">
                  SERIE: {label.serial}
                </div>
              )}
              
              {!label.serial && label.product.usa_numero_serie && (
                <div className="mt-1 flex items-center gap-1 bg-amber-500 text-white px-2 py-0.5 rounded-full text-[9px] font-black tracking-widest">
                  <HiExclamation className="h-3 w-3" />
                  SIN SERIE ASIGNADA
                </div>
              )}
            </div>
          ))}
          
          {labelsToPrint.length === 0 && (
            <div className="col-span-full py-20 text-center">
              <p className="text-slate-400 font-bold uppercase tracking-widest">No hay etiquetas para mostrar</p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
