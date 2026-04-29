"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Calendar,
  FilterX,
  Search,
  ShoppingCart,
  TrendingUp,
  Tag,
  Car,
  ChevronLeft,
  ChevronRight,
  User,
  Clock,
  CalendarDays,
  ChevronDown,
  Check
} from "lucide-react";
import { getPresupuestosSupabase } from "@/modules/presupuestos";
import type { PresupuestoCompleto } from "@/modules/presupuestos";
import { motion, AnimatePresence } from "framer-motion";
import { useRef } from "react";

function formatearMoneda(valor: number) {
  return `$${valor.toLocaleString("es-AR")}`;
}

export function EstadisticasPage() {
  const [periodoTipo, setPeriodoTipo] = useState<string>("todos");
  const [fechaInicio, setFechaInicio] = useState<string>("");
  const [fechaFin, setFechaFin] = useState<string>("");
  const [filtroMarca, setFiltroMarca] = useState<string>("todas");
  const [searchMarca, setSearchMarca] = useState("");
  const [searchCliente, setSearchCliente] = useState("");
  const [searchRepuesto, setSearchRepuesto] = useState("");
  const [paginaActual, setPaginaActual] = useState(1);

  // Estados de UI para Dropdowns/Autocomplete
  const [openPeriodo, setOpenPeriodo] = useState(false);
  const [showMarcaSugerencias, setShowMarcaSugerencias] = useState(false);
  const [showClienteSugerencias, setShowClienteSugerencias] = useState(false);

  const periodoRef = useRef<HTMLDivElement>(null);
  const marcaRef = useRef<HTMLDivElement>(null);
  const clienteRef = useRef<HTMLDivElement>(null);
  const inputFechaInicioRef = useRef<HTMLInputElement>(null);
  const inputFechaFinRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [presupuestosConfirmados, setPresupuestosConfirmados] = useState<PresupuestoCompleto[]>([]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const data = await getPresupuestosSupabase();
      setPresupuestosConfirmados(data.filter(p => p.estado === 'confirmado'));
      setLoading(false);
    }
    loadData();
  }, []);

  // Click outside detection
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (periodoRef.current && !periodoRef.current.contains(target)) setOpenPeriodo(false);
      if (marcaRef.current && !marcaRef.current.contains(target)) setShowMarcaSugerencias(false);
      if (clienteRef.current && !clienteRef.current.contains(target)) setShowClienteSugerencias(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Clientes únicos para sugerencias
  const clientesDisponibles = useMemo(() => {
    const set = new Set<string>();
    presupuestosConfirmados.forEach(p => {
      if (p.cliente) set.add(p.cliente);
    });
    return Array.from(set).sort();
  }, [presupuestosConfirmados]);

  // Sugerencias filtradas - Clientes
  const sugerenciasClientes = useMemo(() => {
    if (!searchCliente.trim() || !showClienteSugerencias) return [];
    const term = searchCliente.toLowerCase();
    return clientesDisponibles
      .filter(c => c.toLowerCase().includes(term))
      .slice(0, 8);
  }, [clientesDisponibles, searchCliente, showClienteSugerencias]);

  // Compute unique values for filters (Only Vehicle Brands)
  const marcasDisponibles = useMemo(() => {
    const marcas = new Set<string>();
    presupuestosConfirmados.forEach((p) => {
      if (p.marca) marcas.add(p.marca);
    });
    return Array.from(marcas).filter(Boolean).sort();
  }, [presupuestosConfirmados]);

  // Sugerencias filtradas - Marcas
  const sugerenciasMarcas = useMemo(() => {
    if (!searchMarca.trim() || !showMarcaSugerencias) return [];
    const term = searchMarca.toLowerCase();
    return marcasDisponibles
      .filter(m => m.toLowerCase().includes(term))
      .slice(0, 8);
  }, [marcasDisponibles, searchMarca, showMarcaSugerencias]);

  // Apply filters
  const ventasFiltradas = useMemo(() => {
    return presupuestosConfirmados.filter((p) => {
      // 1. Period Filter
      let periodMatch = true;
      if (p.confirmadoAt) {
        const date = new Date(p.confirmadoAt);
        const now = new Date();
        
        switch (periodoTipo) {
          case 'hoy':
            periodMatch = date.toDateString() === now.toDateString();
            break;
          case 'semana': {
            const lastWeek = new Date();
            lastWeek.setDate(now.getDate() - 7);
            periodMatch = date >= lastWeek;
            break;
          }
          case 'mes':
            periodMatch = date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
            break;
          case 'anio':
            periodMatch = date.getFullYear() === now.getFullYear();
            break;
          case 'personalizado': {
            if (fechaInicio) {
              const start = new Date(fechaInicio);
              start.setHours(0, 0, 0, 0);
              if (date < start) periodMatch = false;
            }
            if (fechaFin) {
              const end = new Date(fechaFin);
              end.setHours(23, 59, 59, 999);
              if (date > end) periodMatch = false;
            }
            break;
          }
        }
      }

      // 2. Marca Match (Vehicle)
      let marcaMatch = true;
      if (filtroMarca !== "todas") {
        marcaMatch = p.marca === filtroMarca;
      }

      // 3. Cliente Match
      let clienteMatch = true;
      if (searchCliente.trim()) {
        clienteMatch = p.cliente.toLowerCase().includes(searchCliente.toLowerCase());
      }

      return periodMatch && marcaMatch && clienteMatch;
    });
  }, [presupuestosConfirmados, periodoTipo, fechaInicio, fechaFin, filtroMarca, searchCliente]);

  // Compute KPIs
  const montoTotal = ventasFiltradas.reduce((sum, p) => sum + p.total, 0);
  const totalOperaciones = ventasFiltradas.length;
  const ticketPromedio = totalOperaciones > 0 ? montoTotal / totalOperaciones : 0;

  // Process individual items for the table and top products
  const statsMap = useMemo(() => {
    const map = new Map<string, {
      codigo: string;
      descripcion: string;
      marca: string;
      cantidadVendida: number;
      montoGenerado: number;
      frecuencia: number;
    }>();

    const searchTerm = searchRepuesto.trim().toLowerCase();

    ventasFiltradas.forEach((p) => {
      p.items.forEach((item) => {
        if (searchTerm &&
          !item.codigo.toLowerCase().includes(searchTerm) &&
          !item.descripcion.toLowerCase().includes(searchTerm)) {
          return;
        }

        const existing = map.get(item.codigo);
        if (existing) {
          existing.cantidadVendida += item.cantidad;
          existing.montoGenerado += item.cantidad * item.precio;
          existing.frecuencia += 1;
        } else {
          map.set(item.codigo, {
            codigo: item.codigo,
            descripcion: item.descripcion,
            marca: item.marca || "-",
            cantidadVendida: item.cantidad,
            montoGenerado: item.cantidad * item.precio,
            frecuencia: 1,
          });
        }
      });
    });

    return map;
  }, [ventasFiltradas, searchRepuesto]);

  const itemStatsPorMonto = useMemo(() => {
    return Array.from(statsMap.values()).sort((a, b) => b.montoGenerado - a.montoGenerado);
  }, [statsMap]);

  const itemStatsPorCantidad = useMemo(() => {
    return Array.from(statsMap.values()).sort((a, b) => b.cantidadVendida - a.cantidadVendida);
  }, [statsMap]);

  const repuestoMasVendido = itemStatsPorCantidad.length > 0 ? itemStatsPorCantidad[0].descripcion : "-";

  // Data for charts
  const maxCantidadVendida = itemStatsPorCantidad.length > 0 ? itemStatsPorCantidad[0].cantidadVendida : 1;
  const top10RepuestosPorCantidad = itemStatsPorCantidad.slice(0, 10);

  const resetFiltros = () => {
    setPeriodoTipo("todos");
    setFechaInicio("");
    setFechaFin("");
    setFiltroMarca("todas");
    setSearchMarca("");
    setSearchCliente("");
    setSearchRepuesto("");
    setPaginaActual(1);
  };

  const pageSize = 10;
  const totalPaginas = Math.max(1, Math.ceil(itemStatsPorMonto.length / pageSize));
  const paginaActualSegura = Math.min(paginaActual, totalPaginas);

  const paginasVisibles = useMemo(() => {
    const range = 5;
    const step = range - 1; // 4 - Desplazamiento para el solapamiento solicitado
    
    let start = Math.floor((paginaActualSegura - 1) / step) * step + 1;
    
    if (start + range - 1 > totalPaginas) {
      start = Math.max(1, totalPaginas - range + 1);
    }
    
    const pages = [];
    for (let i = start; i < start + range && i <= totalPaginas; i++) {
        pages.push(i);
    }
    return pages;
  }, [totalPaginas, paginaActualSegura]);

  const pagedItems = useMemo(() => {
    const start = (paginaActualSegura - 1) * pageSize;
    return itemStatsPorMonto.slice(start, start + pageSize);
  }, [itemStatsPorMonto, paginaActualSegura]);

  // Reiniciar página cuando cambian los filtros
  useEffect(() => {
    setPaginaActual(1);
  }, [periodoTipo, fechaInicio, fechaFin, filtroMarca, searchMarca, searchCliente, searchRepuesto]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-primary-light)]">
            <BarChart3 className="h-6 w-6 text-[var(--color-primary)]" />
          </div>
          <div>
            <h1 className="text-[24px] font-bold tracking-tight text-[var(--text-primary)]">
              Estadísticas de Ventas
            </h1>
            <p className="text-[14px] text-[var(--text-muted)]">
              Análisis sobre presupuestos confirmados
            </p>
          </div>
        </div>

        {loading && (
          <div className="flex items-center gap-2 rounded-xl border border-[var(--border-light)] bg-yellow-50 px-4 py-2 text-[13px] font-medium text-yellow-700">
            Cargando estadisticas de la Nube...
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={resetFiltros}
            className="flex items-center gap-2 rounded-xl border border-[var(--border-light)] bg-[var(--bg-card)] px-4 py-2 text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-body)] transition-smooth"
          >
            <FilterX className="h-4 w-4" />
            Restablecer
          </button>
        </div>
      </div>

      {/* Filtros Container */}
      <div className="rounded-3xl border border-[var(--border-light)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow-card)] space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Custom Period Dropdown */}
          <div className="space-y-2 relative" ref={periodoRef}>
            <label className="text-[12px] font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-2">
              <Clock className="h-4 w-4 text-[var(--color-primary)]" />
              Periodo de Venta
            </label>
            <button
              onClick={() => setOpenPeriodo(!openPeriodo)}
              className="w-full flex items-center justify-between rounded-2xl border border-[var(--border-light)] bg-[var(--bg-body)] px-4 py-3 text-[14px] text-[var(--text-primary)] outline-none hover:border-[var(--color-primary)] transition-all group"
            >
              <span className="capitalize">{periodoTipo.replace('todos', 'Todos los tiempos').replace('hoy', 'Ventas de Hoy').replace('semana', 'Últimos 7 días').replace('mes', 'Este Mes').replace('anio', 'Este Año').replace('personalizado', 'Rango Personalizado')}</span>
              <ChevronDown className={`h-4 w-4 text-[var(--text-muted)] transition-transform duration-300 ${openPeriodo ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {openPeriodo && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute left-0 right-0 top-full mt-2 bg-white border border-[var(--border-light)] rounded-2xl shadow-2xl z-50 overflow-hidden"
                >
                  {[
                    { val: 'todos', label: 'Todos los tiempos' },
                    { val: 'hoy', label: 'Ventas de Hoy' },
                    { val: 'semana', label: 'Últimos 7 días' },
                    { val: 'mes', label: 'Este Mes' },
                    { val: 'anio', label: 'Este Año' },
                    { val: 'personalizado', label: 'Rango Personalizado' }
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      onClick={() => { setPeriodoTipo(opt.val); setOpenPeriodo(false); }}
                      className={`w-full flex items-center justify-between px-4 py-3 text-[14px] hover:bg-[var(--bg-body)] transition-colors ${periodoTipo === opt.val ? 'text-[var(--color-primary)] font-bold bg-[var(--color-primary-light)]/20' : 'text-[var(--text-secondary)]'}`}
                    >
                      {opt.label}
                      {periodoTipo === opt.val && <Check className="h-4 w-4" />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Smart Marca Search with Autocomplete */}
          <div className="space-y-2 relative" ref={marcaRef}>
            <label className="text-[12px] font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-2">
              <Car className="h-4 w-4 text-[var(--color-primary)]" />
              Marca del Vehículo
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchMarca}
                onFocus={() => { setShowMarcaSugerencias(true); }}
                onChange={(e) => { 
                  const val = e.target.value;
                  setSearchMarca(val); 
                  setShowMarcaSugerencias(true);
                  if (val === '') setFiltroMarca('todas');
                }}
                placeholder={filtroMarca === 'todas' ? "Buscar marca (Ej: Ford)..." : filtroMarca}
                className={`w-full rounded-2xl border border-[var(--border-light)] bg-[var(--bg-body)] pl-10 pr-10 py-3 text-[14px] outline-none transition-all focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] ${filtroMarca !== 'todas' ? 'text-[var(--color-primary)] font-bold' : 'text-[var(--text-primary)]'}`}
              />
              <Car className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
              {filtroMarca !== 'todas' && (
                <button 
                  onClick={() => { setFiltroMarca('todas'); setSearchMarca(''); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-red-500 transition-colors"
                >
                  <FilterX className="h-4 w-4" />
                </button>
              )}
            </div>

            <AnimatePresence>
              {showMarcaSugerencias && (sugerenciasMarcas.length > 0 || searchMarca === '') && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute left-0 right-0 top-full mt-2 bg-white border border-[var(--border-light)] rounded-2xl shadow-2xl z-50 overflow-hidden"
                >
                  <div className="px-4 py-2 border-b border-[var(--border-light)] bg-slate-50 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-tight">SUGERENCIAS ENCONTRADAS</div>
                  {searchMarca === '' && (
                    <button
                      onClick={() => { setFiltroMarca('todas'); setSearchMarca(''); setShowMarcaSugerencias(false); }}
                      className={`w-full text-left px-4 py-3 text-[13px] hover:bg-[var(--bg-body)] transition-colors flex items-center justify-between ${filtroMarca === 'todas' ? 'text-[var(--color-primary)] font-bold bg-[var(--color-primary-light)]/20' : 'text-[var(--text-primary)]'}`}
                    >
                      <span className="flex items-center gap-2 italic">Todas las marcas</span>
                      {filtroMarca === 'todas' && <Check className="h-4 w-4" />}
                    </button>
                  )}
                  {sugerenciasMarcas.map((sug) => (
                    <button
                      key={sug}
                      onClick={() => { setFiltroMarca(sug); setSearchMarca(sug); setShowMarcaSugerencias(false); }}
                      className={`w-full text-left px-4 py-3 text-[13px] hover:bg-[var(--bg-body)] transition-colors flex items-center justify-between ${filtroMarca === sug ? 'text-[var(--color-primary)] font-bold bg-[var(--color-primary-light)]/20' : 'text-[var(--text-primary)]'}`}
                    >
                      <span className="flex items-center gap-2">{sug}</span>
                      {filtroMarca === sug && <Check className="h-4 w-4" />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Smart Cliente Search with Autocomplete */}
          <div className="space-y-2 relative" ref={clienteRef}>
            <label className="text-[12px] font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-2">
              <User className="h-4 w-4 text-[var(--color-primary)]" />
              Filtrar por Cliente
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchCliente}
                onFocus={() => setShowClienteSugerencias(true)}
                onChange={(e) => { setSearchCliente(e.target.value); setShowClienteSugerencias(true); }}
                placeholder="Nombre del cliente..."
                className="w-full rounded-2xl border border-[var(--border-light)] bg-[var(--bg-body)] pl-10 pr-4 py-3 text-[14px] text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] transition-all"
              />
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
            </div>

            <AnimatePresence>
              {showClienteSugerencias && sugerenciasClientes.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute left-0 right-0 top-full mt-2 bg-white border border-[var(--border-light)] rounded-2xl shadow-2xl z-50 overflow-hidden"
                >
                  <div className="px-4 py-2 border-b border-[var(--border-light)] bg-slate-50 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-tight">SUGERENCIAS ENCONTRADAS</div>
                  {sugerenciasClientes.map((sug) => (
                    <button
                      key={sug}
                      onClick={() => { setSearchCliente(sug); setShowClienteSugerencias(false); }}
                      className="w-full text-left px-4 py-3 text-[13px] text-[var(--text-primary)] hover:bg-[var(--bg-body)] hover:text-[var(--color-primary)] transition-colors flex items-center gap-2"
                    >
                      <User className="h-3 w-3 opacity-40" />
                      {sug}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Custom Date Range Picker - Adjusted Layout */}
        {periodoTipo === 'personalizado' && (
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 py-4 px-6 rounded-3xl bg-[var(--bg-body)]/50 border border-[var(--border-light)] animate-in slide-in-from-top-2 duration-300 mx-auto max-w-4xl">
            <div 
              className="flex-1 w-full space-y-1.5 cursor-pointer group"
              onClick={() => {
                if (inputFechaInicioRef.current) {
                  try {
                    inputFechaInicioRef.current.showPicker();
                  } catch (e) {
                    inputFechaInicioRef.current.click();
                  }
                }
              }}
            >
              <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-tighter flex items-center gap-1 group-hover:text-[var(--color-primary)] transition-colors">
                <CalendarDays className="h-3 w-3" />
                Fecha Desde
              </span>
              <div className="relative">
                <input
                  ref={inputFechaInicioRef}
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  className="w-full rounded-2xl border border-[var(--border-light)] bg-white px-4 py-3 text-[14px] text-[var(--text-primary)] outline-none group-hover:border-[var(--color-primary)] transition-all shadow-sm cursor-pointer"
                />
              </div>
            </div>
            
            <div className="hidden md:flex items-center pt-5">
              <div className="h-[2px] w-6 bg-slate-200 rounded-full" />
            </div>

            <div 
              className="flex-1 w-full space-y-1.5 cursor-pointer group"
              onClick={() => {
                if (inputFechaFinRef.current) {
                  try {
                    inputFechaFinRef.current.showPicker();
                  } catch (e) {
                    inputFechaFinRef.current.click();
                  }
                }
              }}
            >
              <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-tighter flex items-center gap-1 group-hover:text-[var(--color-primary)] transition-colors">
                <CalendarDays className="h-3 w-3" />
                Fecha Hasta
              </span>
              <div className="relative">
                <input
                  ref={inputFechaFinRef}
                  type="date"
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
                  className="w-full rounded-2xl border border-[var(--border-light)] bg-white px-4 py-3 text-[14px] text-[var(--text-primary)] outline-none group-hover:border-[var(--color-primary)] transition-all shadow-sm cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* Repuesto Search (Secondary Filter) */}
        <div className="pt-4 border-t border-[var(--border-light)]/50">
          <div className="relative group">
            <input
              type="text"
              value={searchRepuesto}
              onChange={(e) => setSearchRepuesto(e.target.value)}
              placeholder="🔍 Buscar dentro de los resultados por código o descripción de repuesto..."
              className="w-full rounded-2xl border-none bg-[var(--bg-body)] px-5 py-4 text-[14px] text-[var(--text-primary)] outline-none ring-1 ring-inset ring-transparent focus:ring-2 focus:ring-[var(--color-primary)]/40 transition-all font-medium"
            />
            <div className="absolute inset-0 rounded-2xl shadow-inner pointer-events-none opacity-50" />
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="kpi-card group">
          <p className="text-[13px] font-medium text-[var(--text-secondary)]">Ingresos Generados</p>
          <p className="mt-2 text-[26px] font-bold text-[var(--text-primary)]">{formatearMoneda(montoTotal)}</p>
          <div className="absolute right-4 top-4 h-10 w-10 rounded-xl bg-green-50 flex items-center justify-center group-hover:scale-110 transition-transform">
            <TrendingUp className="h-5 w-5 text-green-600" />
          </div>
        </div>
        <div className="kpi-card group">
          <p className="text-[13px] font-medium text-[var(--text-secondary)]">Ventas Realizadas</p>
          <p className="mt-2 text-[26px] font-bold text-[var(--text-primary)]">{totalOperaciones}</p>
          <div className="absolute right-4 top-4 h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center group-hover:scale-110 transition-transform">
            <ShoppingCart className="h-5 w-5 text-blue-600" />
          </div>
        </div>
        <div className="kpi-card group">
          <p className="text-[13px] font-medium text-[var(--text-secondary)]">Ticket Promedio</p>
          <p className="mt-2 text-[26px] font-bold text-[var(--text-primary)]">{formatearMoneda(ticketPromedio)}</p>
          <div className="absolute right-4 top-4 h-10 w-10 rounded-xl bg-purple-50 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Tag className="h-5 w-5 text-purple-600" />
          </div>
        </div>
        <div className="kpi-card group">
          <p className="text-[13px] font-medium text-[var(--text-secondary)] mt-[2px] truncate pr-12" title={repuestoMasVendido}>Top Repuesto: {repuestoMasVendido}</p>
          <p className="mt-2 text-[20px] font-bold text-[var(--color-primary)] line-clamp-1">{itemStatsPorCantidad.length > 0 ? itemStatsPorCantidad[0].cantidadVendida + ' uds.' : '0 uds.'}</p>
          <div className="absolute right-4 top-4 h-10 w-10 rounded-xl bg-orange-50 flex items-center justify-center group-hover:scale-110 transition-transform">
            <BarChart3 className="h-5 w-5 text-orange-600" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
        {/* Tabla de Detalle */}
        <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--bg-card)] shadow-[var(--shadow-card)] overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-[var(--border-light)]">
            <h2 className="text-[16px] font-bold text-[var(--text-primary)]">Detalle de Repuestos Vendidos</h2>
            <p className="text-[13px] text-[var(--text-muted)] mt-0.5">Basado en presupuestos confirmados.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="bg-[var(--bg-body)]">
                  <th className="px-5 py-3 text-left text-[12px] font-semibold text-[var(--text-secondary)] whitespace-nowrap">Código</th>
                  <th className="px-5 py-3 text-left text-[12px] font-semibold text-[var(--text-secondary)]">Descripción</th>
                  <th className="px-5 py-3 text-left text-[12px] font-semibold text-[var(--text-secondary)]">Marca</th>
                  <th className="px-5 py-3 text-right text-[12px] font-semibold text-[var(--text-secondary)]">Cant.</th>
                  <th className="px-5 py-3 text-right text-[12px] font-semibold text-[var(--text-secondary)]">Monto total</th>
                </tr>
              </thead>
              <tbody>
                {pagedItems.map((item) => (
                  <tr key={item.codigo} className="border-t border-[var(--border-light)] hover:bg-[var(--bg-body)] transition-colors">
                    <td className="px-5 py-3 text-[13px] font-medium text-[var(--text-primary)]">{item.codigo}</td>
                    <td className="px-5 py-3 text-[13px] text-[var(--text-secondary)] max-w-[200px] truncate" title={item.descripcion}>{item.descripcion}</td>
                    <td className="px-5 py-3 text-[13px] text-[var(--text-secondary)]">{item.marca}</td>
                    <td className="px-5 py-3 text-right text-[13px] font-bold text-[var(--text-primary)]">{item.cantidadVendida}</td>
                    <td className="px-5 py-3 text-right text-[13px] font-medium text-[var(--color-primary)]">{formatearMoneda(item.montoGenerado)}</td>
                  </tr>
                ))}
                {itemStatsPorMonto.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-[14px] text-[var(--text-muted)]">
                      No se encontraron repuestos para estos filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPaginas > 1 && (
            <div className="px-5 py-6 border-t border-[var(--border-light)] flex flex-col items-center justify-center gap-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={paginaActualSegura <= 1}
                  onClick={() => setPaginaActual(Math.max(1, paginaActualSegura - 1))}
                  className="group flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-light)] bg-[var(--bg-card)] text-[var(--text-secondary)] transition-all hover:bg-[var(--bg-body)] disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
                </button>

                {paginasVisibles.map((pagina) => (
                  <button
                    key={pagina}
                    type="button"
                    onClick={() => setPaginaActual(pagina)}
                    className={`h-9 min-w-9 rounded-xl px-2 text-[13px] font-semibold transition-all ${pagina === paginaActualSegura
                        ? "bg-[var(--color-primary)] text-white shadow-sm"
                        : "border border-[var(--border-light)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-body)]"
                      }`}
                  >
                    {pagina}
                  </button>
                ))}

                <button
                  type="button"
                  disabled={paginaActualSegura >= totalPaginas}
                  onClick={() => setPaginaActual(Math.min(totalPaginas, paginaActualSegura + 1))}
                  className="group flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-light)] bg-[var(--bg-card)] text-[var(--text-secondary)] transition-all hover:bg-[var(--bg-body)] disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </button>
              </div>

              <p className="text-[13px] text-[var(--text-muted)]">
                Mostrando {pagedItems.length} de {itemStatsPorMonto.length} repuestos
              </p>
            </div>
          )}
        </div>

        {/* Gráfico Top Repuestos */}
        <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--bg-card)] shadow-[var(--shadow-card)] p-5">
          <h2 className="text-[16px] font-bold text-[var(--text-primary)]">Repuesto mas Vendidos</h2>
          <p className="text-[13px] text-[var(--text-muted)] mt-0.5 mb-5">Porcentaje sobre el repuesto de mayor venta (stock).</p>

          <div className="space-y-4">
            {top10RepuestosPorCantidad.map((item) => {
              const percentage = Math.max(2, (item.cantidadVendida / maxCantidadVendida) * 100);
              return (
                <div key={item.codigo} className="space-y-1">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="font-semibold text-[var(--text-primary)] truncate max-w-[60%]" title={item.descripcion}>
                      {item.descripcion}
                    </span>
                    <span className="text-[var(--text-secondary)] font-medium">
                      {item.cantidadVendida} uds.
                    </span>
                  </div>
                  <div className="h-2 w-full bg-[var(--bg-body)] rounded-full overflow-hidden">
                    <div
                      className="h-full chart-bar"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)] text-right">{formatearMoneda(item.montoGenerado)} generados</p>
                </div>
              );
            })}

            {top10RepuestosPorCantidad.length === 0 && (
              <p className="text-[13px] text-[var(--text-muted)] text-center py-10">Sin datos para graficar.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

