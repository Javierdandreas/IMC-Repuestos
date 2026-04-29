"use client";

import { useState, useEffect, forwardRef, useImperativeHandle, useRef } from "react";
import {
  Check as IconCheck,
  HelpCircle as IconHelp,
  Search as IconSearch,
  Triangle as IconTriangle,
  Loader2 as IconLoader,
  FileText,
  XCircle,
  SearchCode,
  PlusCircle,
  Save,
  Copy
} from "lucide-react";
import type { ProductoCatalogo } from "../types/presupuesto";
import { buscarProductosEnGESU, buscarProductosExacto, buscarMasivoProductos } from "@/lib/api/catalogo";
import { parseOEMText } from "@/shared/lib/oem-parser";

type Props = {
  onAgregarItem: (producto: ProductoCatalogo, cantidad: number) => void;
};

export interface BuscarRepuestosHandle {
  focus: () => void;
  clear: () => void;
}

export const BuscarRepuestos = forwardRef<BuscarRepuestosHandle, Props>(
  ({ onAgregarItem }, ref) => {
    const [query, setQuery] = useState("");
    const [exactQuery, setExactQuery] = useState("");
    const [resultados, setResultados] = useState<ProductoCatalogo[]>([]);
    const [cargando, setCargando] = useState(false);

    // Estados para el Buscador OEM Masivo
    const [oemMode, setOemMode] = useState(false);
    const [oemText, setOemText] = useState("");
    const [oemCount, setOemCount] = useState<number | null>(null);
    const [parsedCodes, setParsedCodes] = useState<string[]>([]);

    const [cantidades, setCantidades] = useState<Record<string, number>>({});
    const [agregadoCodigo, setAgregadoCodigo] = useState<string | null>(null);

    // Estados para Ingreso Manual
    const [manualMode, setManualMode] = useState(false);
    const [manualItem, setManualItem] = useState({
      codigo: "",
      descripcion: "",
      marca: "", // Nuevo campo opcional
      cantidad: 1,
      precio: 0,
    });

    const inputRef = useRef<HTMLInputElement>(null);

    // Manejador para buscador masivo
    const handleOEMChange = async (text: string) => {
      setOemText(text);
      if (!text.trim()) {
        setOemCount(null);
        setResultados([]);
        return;
      }

      const codes = parseOEMText(text);
      setParsedCodes(codes);
      setOemCount(codes.length);

      if (codes.length > 0) {
        setCargando(true);
        try {
          const prods = await buscarMasivoProductos(codes);
          setResultados(prods);
        } catch (error) {
          console.error("Error en búsqueda masiva OEM:", error);
        } finally {
          setCargando(false);
        }
      } else {
        setResultados([]);
      }
    };

    const limpiarTodo = () => {
      setQuery("");
      setExactQuery("");
      setOemText("");
      setOemCount(null);
      setParsedCodes([]);
      setResultados([]);
      setManualItem({ codigo: "", descripcion: "", marca: "", cantidad: 1, precio: 0 });
    };

    useImperativeHandle(ref, () => ({
      focus: () => {
        if (!oemMode) inputRef.current?.focus();
      },
      clear: () => {
        limpiarTodo();
      },
    }));

    // Manejador para buscador general
    const handleQueryChange = (val: string) => {
      setQuery(val);
      if (val.trim() !== "") {
        setExactQuery("");
      }
    };

    // Manejador para buscador específico
    const handleExactQueryChange = (val: string) => {
      const normalized = val.replace(/\s+/g, ""); // Quitar espacios en tiempo real
      setExactQuery(normalized);
      if (normalized.trim() !== "") {
        setQuery("");
      }
    };

    // Debounce para llamadas a Supabase
    useEffect(() => {
      if (oemMode) return;

      const termoQuery = query.trim();
      const termoExact = exactQuery.trim();
      let active = true;

      if (!termoQuery && !termoExact) {
        setResultados([]);
        setCargando(false);
        return;
      }

      setCargando(true);
      const timeoutId = setTimeout(async () => {
        try {
          let data: ProductoCatalogo[] = [];

          if (termoExact) {
            data = await buscarProductosExacto(termoExact);
          } else if (termoQuery) {
            data = await buscarProductosEnGESU(termoQuery);
          }

          if (active) {
            setResultados(data);
            setCargando(false);
          }
        } catch (error) {
          console.error("Error en búsqueda:", error);
          if (active) setCargando(false);
        }
      }, 300);

      return () => {
        active = false;
        clearTimeout(timeoutId);
      };
    }, [query, exactQuery, oemMode, manualMode]);

    const getCantidad = (codigo: string) => cantidades[codigo] ?? 1;

    const setCantidad = (codigo: string, valor: number) => {
      const cantidadNormalizada = Number.isFinite(valor) && valor > 0 ? Math.floor(valor) : 1;
      setCantidades((prev) => ({
        ...prev,
        [codigo]: cantidadNormalizada,
      }));
    };

    const manejarCambioCantidad = (codigo: string, valor: string) => {
      if (valor.trim() === "") {
        setCantidades((prev) => ({ ...prev, [codigo]: 1 }));
        return;
      }
      setCantidad(codigo, Number(valor));
    };

    const agregarProducto = (producto: ProductoCatalogo) => {
      const cantidad = getCantidad(producto.codigo);
      onAgregarItem(producto, cantidad);
      setAgregadoCodigo(producto.codigo);
      setCantidades((prev) => ({ ...prev, [producto.codigo]: 1 }));
      window.setTimeout(() => {
        setAgregadoCodigo((actual) => actual === producto.codigo ? null : actual);
      }, 1400);
    };

    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {/* Header con Selector de Modo */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 rounded-lg">
              <IconSearch className="h-5 w-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Buscar Repuestos</h2>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => {
                setOemMode(false);
                setManualMode(false);
                limpiarTodo();
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${!oemMode && !manualMode
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200"
                }`}
            >
              <IconSearch className="h-4 w-4" />
              General
            </button>
            <button
              onClick={() => {
                setOemMode(true);
                setManualMode(false);
                limpiarTodo();
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${oemMode
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200"
                }`}
            >
              <FileText className="h-4 w-4" />
              Pegado OEM
            </button>
            <button
              onClick={() => {
                setManualMode(true);
                setOemMode(false);
                limpiarTodo();
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${manualMode
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200"
                }`}
            >
              <PlusCircle className="h-4 w-4" />
              Ingreso Manual
            </button>
          </div>
        </div>

        {/* Áreas de Input según Modo */}
        {manualMode ? (
          <div className="mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between mb-4">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <PlusCircle className="h-4 w-4" />
                Cargar repuesto manualmente
              </label>
              <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-bold uppercase">
                Campos obligatorios
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-200 shadow-inner">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 px-1">Código</label>
                <input
                  type="text"
                  placeholder="Ej: MAN-001"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                  value={manualItem.codigo}
                  onChange={(e) => setManualItem(prev => ({ ...prev, codigo: e.target.value.toUpperCase() }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 px-1">Descripción</label>
                <input
                  type="text"
                  placeholder="Nombre del repuesto..."
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                  value={manualItem.descripcion}
                  onChange={(e) => setManualItem(prev => ({ ...prev, descripcion: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 px-1">Marca (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ej: Bosch, SKF..."
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                  value={manualItem.marca}
                  onChange={(e) => setManualItem(prev => ({ ...prev, marca: e.target.value.toUpperCase() }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 px-1">Cantidad</label>
                <input
                  type="number"
                  min="1"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                  value={manualItem.cantidad}
                  onChange={(e) => setManualItem(prev => ({ ...prev, cantidad: parseInt(e.target.value) || 1 }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 px-1">Precio Unitario</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none font-bold"
                    value={manualItem.precio || ""}
                    onChange={(e) => {
                      const val = e.target.value.replace(",", ".");
                      if (val === "" || /^\d*\.?\d*$/.test(val)) {
                        setManualItem(prev => ({ ...prev, precio: parseFloat(val) || 0 }));
                      }
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  if (!manualItem.codigo || !manualItem.descripcion || !manualItem.precio) {
                    alert("Por favor completá Código, Descripción y Precio.");
                    return;
                  }

                  onAgregarItem({
                    codigo: manualItem.codigo,
                    descripcion: manualItem.descripcion,
                    precio: manualItem.precio,
                    marca: manualItem.marca || "",
                    stock: 0,
                    ubicacion: "INGRESO MANUAL"
                  }, manualItem.cantidad);

                  // Limpiar y feedback
                  setAgregadoCodigo(manualItem.codigo);
                  setManualItem({ codigo: "", descripcion: "", marca: "", cantidad: 1, precio: 0 });
                  window.setTimeout(() => setAgregadoCodigo(null), 1500);
                }}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all shadow-sm ${agregadoCodigo
                  ? "bg-emerald-600 text-white"
                  : "bg-blue-600 text-white hover:bg-blue-700 active:scale-95"
                  }`}
              >
                {agregadoCodigo ? (
                  <><IconCheck className="h-4 w-4" /> Guardado</>
                ) : (
                  <><Save className="h-4 w-4" /> Guardar Ítem</>
                )}
              </button>
            </div>
          </div>
        ) : !oemMode ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <IconSearch className="h-4 w-4 text-slate-400" />
              </div>
              <input
                ref={inputRef}
                type="text"
                placeholder="Buscador general: código, descripción, marca..."
                className="block w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
              />
              {cargando && query && (
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <IconLoader className="h-4 w-4 text-blue-500 animate-spin" />
                </div>
              )}
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <IconSearch className="h-3 w-3 text-slate-400" />
              </div>
              <input
                type="text"
                placeholder="Buscador específico: código o palabra clave (exacto)..."
                className="block w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                value={exactQuery}
                onChange={(e) => handleExactQueryChange(e.target.value)}
              />
              {cargando && exactQuery && (
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <IconLoader className="h-4 w-4 text-blue-500 animate-spin" />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <SearchCode className="h-4 w-4" />
                Pegado Inteligente OEM
              </label>
              <div className="flex items-center gap-2">
                {oemCount !== null && (
                  <>
                    <button
                      onClick={() => {
                        const textToCopy = parsedCodes.join(" ");
                        navigator.clipboard.writeText(textToCopy);
                        setAgregadoCodigo("COPIADO_OEM"); // Usamos este estado para feedback temporal
                        window.setTimeout(() => setAgregadoCodigo(null), 2000);
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all shadow-sm ${agregadoCodigo === "COPIADO_OEM"
                        ? "bg-emerald-600 text-white"
                        : "bg-white text-blue-600 border border-blue-200 hover:bg-blue-50"
                        }`}
                      title="Copiar códigos en una fila"
                    >
                      {agregadoCodigo === "COPIADO_OEM" ? (
                        <IconCheck className="h-3 w-3" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      {agregadoCodigo === "COPIADO_OEM" ? "¡Copiado!" : "Copiar todo"}
                    </button>
                    <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-1 rounded-full font-bold">
                      {oemCount} códigos procesados
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="relative">
              <textarea
                className="block w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all min-h-[140px]"
                placeholder="OE 8V0 698 151 — VW / SEAT / AUDI / SKODA&#10;OE 8V0 698 151 B — VW / SEAT / AUDI / SKODA..."
                value={oemText}
                onChange={(e) => handleOEMChange(e.target.value)}
              />
              <div className="absolute bottom-3 right-3 flex items-center gap-2">
                {cargando && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-white shadow-sm border border-blue-100 rounded-lg">
                    <IconLoader className="h-3 w-3 text-blue-600 animate-spin" />
                    <span className="text-[10px] font-bold text-blue-600 uppercase">Buscando...</span>
                  </div>
                )}
                {oemText && (
                  <button
                    onClick={limpiarTodo}
                    className="p-1.5 text-slate-400 hover:text-red-500 transition-colors bg-white rounded-lg shadow-sm border border-slate-100"
                  >
                    <XCircle className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>
            {parsedCodes.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5 max-h-20 overflow-y-auto p-1 bg-slate-50/50 rounded-lg border border-slate-100">
                {parsedCodes.map((code) => (
                  <span key={code} className="px-2 py-0.5 bg-white text-slate-600 border border-slate-200 rounded text-[10px] font-mono shadow-sm">
                    {code}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Lista de Resultados */}
        <div className="space-y-3">
          {resultados.map((producto) => {
            const agregado = agregadoCodigo === producto.codigo;

            // Colores por stock
            let stockClasses = "border-slate-100 bg-white";
            let stockBadgeClass = "bg-slate-100 text-slate-600";

            if (producto.stock <= 0) {
              stockClasses = "border-red-300 bg-red-100/50";
              stockBadgeClass = "bg-red-100 text-red-800 border border-red-300";
            } else if (producto.stock <= 2) {
              stockClasses = "border-amber-400 bg-amber-100/40";
              stockBadgeClass = "bg-amber-200 text-amber-900 border border-amber-400";
            } else {
              stockClasses = "border-emerald-200 bg-emerald-50";
              stockBadgeClass = "bg-emerald-100 text-emerald-800 border border-emerald-200";
            }

            return (
              <div
                key={producto.codigo}
                className={`flex flex-wrap items-center gap-4 rounded-2xl border p-4 transition-all hover:shadow-md ${stockClasses}`}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm border border-slate-100 text-2xl">
                  📦
                </div>

                <div className="min-w-[200px] flex-1">
                  <p className="text-base font-bold text-slate-900 leading-tight">
                    {producto.codigo}
                  </p>
                  <p className="text-sm text-slate-600 line-clamp-1">
                    {producto.descripcion}
                  </p>
                  <p className="text-[11px] font-bold text-blue-700 uppercase tracking-wide">
                    {producto.marca}
                  </p>
                </div>

                <div className="hidden lg:flex items-center gap-2">
                  <div className="p-2 bg-white rounded-lg border border-slate-100 shadow-sm text-slate-400">
                    <IconTriangle className="h-4 w-4" />
                  </div>
                </div>

                <div className="text-lg font-black text-slate-700">
                  ${producto.precio.toLocaleString("es-AR")}
                </div>

                <div className={`flex flex-col items-center justify-center rounded-xl px-3 py-2 text-xs shadow-sm ${stockBadgeClass} text-center min-w-[100px]`}>
                  <div className="font-bold flex items-center justify-center gap-1">
                    <IconTriangle className={`h-3 w-3 ${producto.stock <= 0 ? "text-red-500" : "text-amber-500"}`} />
                    Stock: {producto.stock}
                  </div>
                  <div className="opacity-70 truncate max-w-[110px] font-medium">{producto.ubicacion || "Sin Ubicación"}</div>
                </div>

                <div className="flex items-center gap-1 bg-white p-1 rounded-xl shadow-sm border border-slate-100">
                  <button
                    onClick={() => setCantidad(producto.codigo, getCantidad(producto.codigo) - 1)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={getCantidad(producto.codigo)}
                    onChange={(e) => manejarCambioCantidad(producto.codigo, e.target.value)}
                    className="w-10 text-center text-sm font-bold outline-none bg-transparent"
                  />
                  <button
                    onClick={() => setCantidad(producto.codigo, getCantidad(producto.codigo) + 1)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600"
                  >
                    +
                  </button>
                </div>

                <button
                  onClick={() => agregarProducto(producto)}
                  className={`flex h-11 min-w-[120px] items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold shadow-sm transition-all ${agregado
                    ? "bg-emerald-600 text-white"
                    : "bg-blue-600 text-white hover:bg-blue-700 active:scale-95"
                    }`}
                >
                  {agregado ? (
                    <><IconCheck className="h-4 w-4" /> Agregado</>
                  ) : (
                    "Agregar"
                  )}
                </button>
              </div>
            );
          })}

          {/* Mensajes de Estado */}
          {resultados.length === 0 && !cargando && (
            <div className="rounded-2xl border-2 border-dashed border-slate-100 p-10 text-center">
              <div className="inline-flex p-3 bg-slate-50 rounded-full mb-3">
                <IconSearch className="h-6 w-6 text-slate-300" />
              </div>
              <p className="text-sm text-slate-500 font-medium">
                {oemMode
                  ? oemText
                    ? "No se encontraron repuestos para estos códigos OEM"
                    : "Pegá los códigos de Autodoc para empezar la búsqueda masiva"
                  : (query || exactQuery)
                    ? "No se encontraron repuestos con ese criterio"
                    : "Escribí o pegá un código para buscar repuestos"
                }
              </p>
            </div>
          )}
        </div>
      </section>
    );
  }
);

BuscarRepuestos.displayName = "BuscarRepuestos";
