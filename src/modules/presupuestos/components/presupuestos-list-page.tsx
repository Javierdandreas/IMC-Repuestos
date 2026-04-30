"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

import { exportarPresupuestoPDF } from "../utils/exportar-presupuesto-pdf";
import { useUser } from "@/context/UserContext";
import { crearNotificacionSupabase, marcarNotificacionesPresupuestoLeidas } from "@/modules/notificaciones";
import { usePermissions } from "@/modules/auth/components/usePermissions";
import { supabaseBrowser as supabase } from "@/utils/supabase/client";
import {
  duplicarPresupuesto,
  recotizarPresupuesto,
  setEditorDraft,
  clearEditorDraft,
} from "../repos/presupuestos-storage";
import {
  getPresupuestosSupabase,
  actualizarEstadoPresupuestoSupabase,
  confirmarItemsParcialesSupabase,
  eliminarPresupuestoSupabase,
  guardarRevisionDepositoSupabase,
  marcarTodoSeparadoDepositoSupabase,
  representarPresupuestoEnPreparacionSupabase
} from "../repos/presupuestos";
import { obtenerProductosPorCodigos } from "@/modules/presupuestos/repos/catalogo-presupuestos";
import {
  getTheme,
  formatearFecha,
  filtrarPorStatus,
  expandirPorEnvios,
  compareUbicacionesAsc
} from "../utils/presupuestos-utils";

import type {
  PresupuestoCompleto,
  PresupuestoItem,
} from "../types/presupuesto";

// Sub-componentes modulares
import { PresupuestoFilters } from "./presupuesto-filters";
import { PresupuestoTable } from "./presupuesto-table";
import { PresupuestoModalsManager } from "./presupuesto-modals-manager";

type Estado = "confirmados" | "pendientes" | "general";

type Props = {
  title: string;
  status: Estado;
};

type Filtro =
  | "todos"
  | "cliente"
  | "fecha"
  | "marca"
  | "telefono"
  | "modelo"
  | "chasis"
  | "patente";

type DialogAction =
  | { open: false }
  | {
    open: true;
    title: string;
    description: string;
    confirmText: string;
    confirmVariant?: "primary" | "danger" | "warning";
    onConfirm: () => void;
  };

export function PresupuestosListPage({ title, status }: Props) {
  const router = useRouter();
  const theme = getTheme(status);
  const { user: usuarioActual } = useUser();
  const { hasAnyPermission, hasPermission } = usePermissions();

  const [search, setSearch] = useState("");
  const [filtroActivo, setFiltroActivo] = useState<Filtro>("todos");
  const [paginaActual, setPaginaActual] = useState(1);
  const [menuAbiertoId, setMenuAbiertoId] = useState<string | null>(null);
  const [menuDirection, setMenuDirection] = useState<"up" | "down">("down");
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  const [rowSeleccionada, setRowSeleccionada] = useState<PresupuestoCompleto | null>(null);
  const [duplicarAbierto, setDuplicarAbierto] = useState(false);
  const [rowParaDuplicar, setRowParaDuplicar] = useState<PresupuestoCompleto | null>(null);
  const [rowParaMenu, setRowParaMenu] = useState<PresupuestoCompleto | null>(null);
  const [checkedItems, setCheckedItems] = useState<string[]>([]);
  const [detailPage, setDetailPage] = useState(1);
  const [permissionToast, setPermissionToast] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [mostrarDetalleInfo, setMostrarDetalleInfo] = useState(false);
  const [dialogAction, setDialogAction] = useState<DialogAction>({ open: false });
  const [isProcessing, setIsProcessing] = useState(false);

  const menuRef = useRef<HTMLDivElement | null>(null);
  const [presupuestos, setPresupuestos] = useState<PresupuestoCompleto[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    const data = await getPresupuestosSupabase(status);
    setPresupuestos(data);

    if (rowSeleccionada) {
      const originalId = (rowSeleccionada as any)._originalId || rowSeleccionada.id;
      const updatedParent = data.find((r) => r.id === originalId);

      if (updatedParent) {
        if ((rowSeleccionada as any)._originalId) {
          const expanded = expandirPorEnvios([updatedParent]);
          const updatedVirtual = expanded.find(v => v.id === rowSeleccionada.id);
          if (updatedVirtual) setRowSeleccionada(updatedVirtual);
        } else {
          setRowSeleccionada(updatedParent);
        }
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel("presupuestos-all-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "presupuestos" }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "presupuesto_items" }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const mainContainer = document.querySelector("main");
    if (mainContainer) mainContainer.scrollTo(0, 0);
    else window.scrollTo(0, 0);
  }, [status]);

  const puedeOperarDeposito = hasAnyPermission([
    "presupuestos.preparar",
    "presupuestos.entregar",
  ]);
  const puedeOperarMostrador = hasAnyPermission([
    "presupuestos.crear",
    "presupuestos.editar",
    "presupuestos.eliminar",
  ]);
  const puedeConfirmar = hasPermission("presupuestos.confirmar");

  useEffect(() => {
    const handleEvents = (event: Event) => {
      const target = event.target as Node;
      if (event.type === "mousedown") {
        if (menuRef.current && !menuRef.current.contains(target)) setMenuAbiertoId(null);
      }
      else if (event.type === "scroll" || event.type === "wheel") setMenuAbiertoId(null);
    };
    document.addEventListener("mousedown", handleEvents);
    document.addEventListener("scroll", handleEvents, true);
    window.addEventListener("resize", () => setMenuAbiertoId(null));
    return () => {
      document.removeEventListener("mousedown", handleEvents);
      document.removeEventListener("scroll", handleEvents, true);
      window.removeEventListener("resize", () => setMenuAbiertoId(null));
    };
  }, []);

  const mostrarPermisoDenegado = (text = "Su usuario no tiene permitido hacer esta acción") => {
    setPermissionToast(text);
    window.setTimeout(() => setPermissionToast(null), 2400);
  };

  const mostrarExito = (text: string) => {
    setSuccessToast(text);
    window.setTimeout(() => setSuccessToast(null), 2200);
  };

  const rows = useMemo(() => filtrarPorStatus(presupuestos, status), [presupuestos, status]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (!term) return true;
      if (filtroActivo === "todos") {
        return [row.codigo, row.fecha, row.cliente, row.telefono, row.marca, row.modelo, row.chasis, row.patente].join(" ").toLowerCase().includes(term);
      }
      const mapa: Record<Filtro, string> = {
        todos: "",
        cliente: row.cliente,
        fecha: formatearFecha(row.fecha),
        marca: row.marca,
        telefono: row.telefono,
        modelo: row.modelo,
        chasis: row.chasis,
        patente: row.patente,
      };
      return (mapa[filtroActivo] || "").toLowerCase().includes(term);
    });
  }, [rows, search, filtroActivo]);

  const rowsOrdenadas = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      if (status === "confirmados") {
        const timeA = a.confirmadoAt ? new Date(a.confirmadoAt).getTime() : 0;
        const timeB = b.confirmadoAt ? new Date(b.confirmadoAt).getTime() : 0;
        if (timeB !== timeA) return timeB - timeA;
      }
      const dateA = new Date(a.fecha).getTime();
      const dateB = new Date(b.fecha).getTime();
      if (dateB !== dateA) return dateB - dateA;
      return String(b.id).localeCompare(String(a.id));
    });
  }, [filteredRows, status]);

  const pageSize = 10;
  const totalPaginas = Math.max(1, Math.ceil(rowsOrdenadas.length / pageSize));
  const paginaActualSegura = Math.min(paginaActual, totalPaginas);

  const pagedRows = useMemo(() => {
    const start = (paginaActualSegura - 1) * pageSize;
    return rowsOrdenadas.slice(start, start + pageSize);
  }, [rowsOrdenadas, paginaActualSegura]);

  const detailItemsOrdenados = useMemo(() => {
    if (!rowSeleccionada) return [];
    let items = [...rowSeleccionada.items];
    if (status === "confirmados") {
      return items.sort((a, b) => compareUbicacionesAsc(a.ubicacion || "", b.ubicacion || ""));
    }
    return items;
  }, [rowSeleccionada, status]);

  const detailItemsPageSize = 7;
  const detailTotalPages = Math.max(1, Math.ceil(detailItemsOrdenados.length / detailItemsPageSize));
  const detailPageSafe = Math.min(detailPage, detailTotalPages);

  const detailItems = useMemo(() => {
    const start = (detailPageSafe - 1) * detailItemsPageSize;
    return detailItemsOrdenados.slice(start, start + detailItemsPageSize);
  }, [detailItemsOrdenados, detailPageSafe]);

  const abrirDialogo = (config: Omit<Extract<DialogAction, { open: true }>, "open">) => {
    setDialogAction({ open: true, ...config });
  };

  const cerrarDialogo = () => setDialogAction({ open: false });

  const confirmarDialogo = () => {
    if (!dialogAction.open) return;
    dialogAction.onConfirm();
    cerrarDialogo();
  };

  const irANuevoPresupuesto = () => {
    if (!puedeOperarMostrador) { mostrarPermisoDenegado(); return; }
    clearEditorDraft();
    router.push("/presupuestos/nuevo");
  };

  const [modoDetalle, setModoDetalle] = useState<"view" | "confirm">("view");

  const abrirDetalle = (row: PresupuestoCompleto, modo: "view" | "confirm" = "view") => {
    setModoDetalle(modo);
    let rowParaMostrar = { ...row };
    const isNewPreparation = status === "confirmados" && puedeOperarDeposito && usuarioActual && (!row.estadoDeposito || row.estadoDeposito === "sin_revisar");
    if (isNewPreparation) {
      rowParaMostrar = { ...rowParaMostrar, estadoDeposito: "en_preparacion", preparadorNombre: usuarioActual?.nombre } as any;
    }
    setRowSeleccionada(rowParaMostrar);
    setDetalleAbierto(true);
    setDetailPage(1);
    setCheckedItems(status === "confirmados" ? rowParaMostrar.items.filter((item: PresupuestoItem) => item.estadoDepositoItem === "separado").map((item: PresupuestoItem) => item.id || item.codigo) : []);
    setMenuAbiertoId(null);
    if (isNewPreparation) {
      const realId = (row as any)._originalId || row.id;
      const isEnvio = row.codigo.includes("ENV-");
      const codEnvio = isEnvio ? row.codigo : undefined;
      setPresupuestos(prev => prev.map(p => {
        if (p.id === realId) {
          let currentSeparador = p.separadorNombre || usuarioActual!.nombre;
          if (codEnvio) {
            let currentEnvios: string[] = [];
            if (p.separadorNombre && p.separadorNombre.includes('||')) {
              const parts = p.separadorNombre.split('||');
              currentSeparador = parts[0];
              currentEnvios = parts[1].split(',').filter(Boolean);
            } else if (p.separadorNombre) currentSeparador = p.separadorNombre;
            if (!currentEnvios.includes(codEnvio)) currentEnvios.push(codEnvio);
            currentSeparador = `${currentSeparador}||${currentEnvios.join(',')}`;
          }
          return { ...p, estadoDeposito: 'en_preparacion', separadorNombre: currentSeparador };
        }
        return p;
      }));
      representarPresupuestoEnPreparacionSupabase(realId, usuarioActual?.nombre || "Sistema", codEnvio).then(() => refresh());
    }
  };

  const cerrarDetalle = () => {
    setDetalleAbierto(false);
    setRowSeleccionada(null);
    setCheckedItems([]);
    setDetailPage(1);
  };

  const editarPresupuesto = (row: PresupuestoCompleto) => {
    if (!puedeOperarMostrador) { mostrarPermisoDenegado(); return; }
    setEditorDraft({ modo: "editar", presupuestoId: row.id, conservarCliente: true, presupuesto: row, sourceView: status });
    router.push("/presupuestos/nuevo");
  };

  const abrirDuplicar = (row: PresupuestoCompleto) => {
    if (!puedeOperarMostrador) { mostrarPermisoDenegado(); return; }
    setRowParaDuplicar(row);
    setDuplicarAbierto(true);
    setMenuAbiertoId(null);
  };

  const confirmarDuplicar = (conservarCliente: boolean) => {
    if (!rowParaDuplicar) return;
    const duplicado = duplicarPresupuesto(rowParaDuplicar, conservarCliente);
    setEditorDraft({ modo: "duplicar", presupuestoId: duplicado.id, conservarCliente, presupuesto: duplicado, sourceView: status });
    setDuplicarAbierto(false);
    setRowParaDuplicar(null);
    router.push("/presupuestos/nuevo");
  };

  const recotizar = async (row: PresupuestoCompleto) => {
    if (!puedeOperarMostrador) { mostrarPermisoDenegado(); return; }
    try {
      const codigos = Array.from(new Set(row.items.map(item => item.codigo)));
      const catalogoActualizado = await obtenerProductosPorCodigos(codigos);
      const actualizado = recotizarPresupuesto(row, catalogoActualizado);
      if (!actualizado) { window.alert("No se pudo recotizar el presupuesto."); return; }
      setEditorDraft({ modo: "recotizar", presupuestoId: actualizado.id, conservarCliente: true, presupuesto: actualizado, sourceView: status });
      setMenuAbiertoId(null);
      router.push("/presupuestos/nuevo");
    } catch (error) { console.error("Error al recotizar:", error); window.alert("Ocurrió un error al obtener los precios actualizados."); }
  };

  const confirmar = (row: PresupuestoCompleto) => {
    if (!puedeConfirmar) { mostrarPermisoDenegado(); return; }
    abrirDetalle(row, "confirm");
  };

  const volverAPendiente = (row: PresupuestoCompleto) => {
    if (!puedeOperarMostrador) { mostrarPermisoDenegado(); return; }
    abrirDialogo({
      title: "Volver a Pendientes",
      description: `¿Querés volver el presupuesto de ${row.cliente || "este cliente"} a Pendientes?`,
      confirmText: "Volver a pendientes",
      confirmVariant: "warning",
      onConfirm: async () => {
        try {
          setIsProcessing(true);
          await actualizarEstadoPresupuestoSupabase(row.id, "pendiente");
          await refresh();
          if (rowSeleccionada?.id === row.id) cerrarDetalle();
        } catch (error) { console.error("Error devolviendo a pendiente:", error); window.alert("No se pudo volver el presupuesto a pendientes."); }
        finally { setIsProcessing(false); }
      },
    });
  };

  const eliminarFila = (row: PresupuestoCompleto) => {
    if (!puedeOperarMostrador) { mostrarPermisoDenegado(); return; }
    abrirDialogo({
      title: "Eliminar presupuesto",
      description: `Esta acción eliminará el presupuesto de ${row.cliente || "este cliente"}. ¿Querés continuar?`,
      confirmText: "Eliminar",
      confirmVariant: "danger",
      onConfirm: async () => {
        try {
          setIsProcessing(true);
          const realId = (row as any)._originalId || row.id;
          await eliminarPresupuestoSupabase(realId);
          if (rowSeleccionada?.id === row.id) cerrarDetalle();
          await refresh();
        } catch (error: any) { console.error("Error eliminando presupuesto:", error); window.alert(`No se pudo eliminar el presupuesto: ${error.message || "Error desconocido"}`); }
        finally { setIsProcessing(false); }
      },
    });
  };

  const exportarPDF = async (row: PresupuestoCompleto) => {
    try { await exportarPresupuestoPDF(row); }
    catch (error) { console.error("Error al exportar PDF:", error); window.alert("No se pudo exportar el PDF."); }
  };

  const exportarLista = () => { window.alert("Por ahora dejamos la exportación individual en PDF. La exportación masiva la hacemos después."); };

  const toggleCheckedItem = (itemId: string) => {
    setCheckedItems((prev) => prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]);
  };

  const guardarConfirmacionMostrador = async () => {
    if (!rowSeleccionada || !puedeConfirmar) { mostrarPermisoDenegado(); return; }
    if (checkedItems.length === 0) { window.alert("Seleccioná al menos un ítem para confirmar."); return; }
    try {
      setIsProcessing(true);
      const result = await confirmarItemsParcialesSupabase(
        rowSeleccionada.id,
        checkedItems,
        usuarioActual?.nombre || "Sistema"
      );
      await crearNotificacionSupabase({
        userRole: "deposito",
        titulo: `${rowSeleccionada.cliente || "CLIENTE"} - Nuevo Envío`,
        mensaje: `Se confirmó un nuevo envío (${result.codigoEnvio}) para ${rowSeleccionada.cliente || "ESTE CLIENTE"}.`,
        tipo: "confirmacion",
        presupuestoId: rowSeleccionada.id,
        codigoOP: rowSeleccionada.codigo,
      });
      await refresh();
      mostrarExito(`Ítems confirmados correctamente. Envío generado: ${result.codigoEnvio}`);
      setCheckedItems([]);
      cerrarDetalle();
    } catch (error: any) { console.error("Error confirmando ítems:", error); window.alert(`No se pudo confirmar la selección: ${error.message}`); }
    finally { setIsProcessing(false); }
  };

  const agregarItemsAExistente = () => {
    if (!rowSeleccionada || !puedeOperarMostrador) { mostrarPermisoDenegado(); return; }
    setEditorDraft({ modo: "editar", presupuestoId: rowSeleccionada.id, conservarCliente: true, presupuesto: rowSeleccionada, sourceView: status });
    router.push("/presupuestos/nuevo");
  };

  const guardarDetalleDeposito = async () => {
    if (!rowSeleccionada || !puedeOperarDeposito) { mostrarPermisoDenegado(); return; }
    try {
      setIsProcessing(true);
      const realId = (rowSeleccionada as any)._originalId || rowSeleccionada.id;
      const idsShipment = rowSeleccionada.items.map(i => i.id || i.codigo);
      const idsSeparados = checkedItems.filter(id => idsShipment.includes(id));
      await guardarRevisionDepositoSupabase(
        realId,
        idsShipment,
        idsSeparados,
        usuarioActual?.nombre || "Depósito"
      );
      const todoSeparado = idsSeparados.length === rowSeleccionada.items.length;
      await crearNotificacionSupabase({
        userRole: "vendedor",
        titulo: todoSeparado ? `${rowSeleccionada.cliente || "CLIENTE"} separado (${rowSeleccionada.codigo})` : `${rowSeleccionada.cliente || "CLIENTE"} (${rowSeleccionada.codigo} - PARCIAL)`,
        mensaje: todoSeparado ? `El envío ${rowSeleccionada.codigo} de ${rowSeleccionada.cliente || "ESTE CLIENTE"} quedó completamente separado.` : `El envío ${rowSeleccionada.codigo} de ${rowSeleccionada.cliente || "ESTE CLIENTE"} quedó guardado con faltantes.`,
        tipo: todoSeparado ? "deposito" : "deposito_parcial",
        presupuestoId: realId,
        codigoOP: rowSeleccionada.codigo,
      });
      await marcarNotificacionesPresupuestoLeidas(realId, "confirmacion");
      await refresh();
      cerrarDetalle();
      mostrarExito("Guardado con éxito.");
    } catch (e) { console.error("Error guardando revisión:", e); window.alert("No se pudo guardar la revisión."); }
    finally { setIsProcessing(false); }
  };

  const marcarPresupuestoSeparado = async () => {
    if (!rowSeleccionada || !puedeOperarDeposito) { mostrarPermisoDenegado(); return; }
    try {
      setIsProcessing(true);
      const realId = (rowSeleccionada as any)._originalId || rowSeleccionada.id;
      const idsAMarcar = rowSeleccionada.items.map(i => i.id || i.codigo);
      await marcarTodoSeparadoDepositoSupabase(
        realId,
        usuarioActual?.nombre || "Depósito",
        idsAMarcar
      );
      await crearNotificacionSupabase({
        userRole: "mostrador",
        titulo: `${rowSeleccionada.cliente || "CLIENTE"} separado (${rowSeleccionada.codigo})`,
        mensaje: `Depósito preparó el envío ${rowSeleccionada.codigo} de ${rowSeleccionada.cliente || "ESTE CLIENTE"}.`,
        tipo: "deposito",
        presupuestoId: realId,
        codigoOP: rowSeleccionada.codigo,
      });
      await marcarNotificacionesPresupuestoLeidas(realId, "confirmacion");
      await refresh();
      cerrarDetalle();
      mostrarExito("Envío separado con éxito.");
    } catch (e) { console.error("Error marcando como separado:", e); window.alert("No se pudo separar el envío."); }
    finally { setIsProcessing(false); }
  };

  const paginasVisibles = useMemo(() => {
    const range = 5;
    const step = range - 1;
    let start = Math.floor((paginaActualSegura - 1) / step) * step + 1;
    if (start + range - 1 > totalPaginas) start = Math.max(1, totalPaginas - range + 1);
    const pages = [];
    for (let i = start; i < start + range && i <= totalPaginas; i++) pages.push(i);
    return pages;
  }, [totalPaginas, paginaActualSegura]);

  const getRowBackground = (estadoDeposito?: string) => {
    if (status !== "confirmados") return "";
    if (estadoDeposito === "separado") return "bg-[#f1fbf4]";
    if (estadoDeposito === "con_faltante") return "bg-[#fff9e9]";
    if (estadoDeposito === "en_preparacion") return "bg-[#eef4ff]";
    return "";
  };

  const toggleMenu = (row: PresupuestoCompleto, event: React.MouseEvent<HTMLButtonElement>) => {
    if (menuAbiertoId === row.id) { setMenuAbiertoId(null); setRowParaMenu(null); return; }
    const buttonRect = event.currentTarget.getBoundingClientRect();
    const headerHeight = 64;
    const topSafeMargin = 12;
    const bottomSafeMargin = 12;
    const estimatedMenuHeight = 340;
    const availableAbove = buttonRect.top - headerHeight - topSafeMargin;
    const availableBelow = window.innerHeight - buttonRect.bottom - bottomSafeMargin;
    if (availableBelow < estimatedMenuHeight && availableAbove > availableBelow) {
      setMenuDirection("up");
      setMenuPosition({ top: buttonRect.top, left: buttonRect.right });
    } else {
      setMenuDirection("down");
      setMenuPosition({ top: buttonRect.bottom, left: buttonRect.right });
    }
    setRowParaMenu(row);
    setMenuAbiertoId(row.id);
  };

  return (
    <>
      <div className="space-y-5 animate-fade-in">
        <section className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${theme.titleIconBg} ${theme.titleIconText}`}>
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h1 className="text-[26px] font-bold tracking-tight text-[var(--text-primary)]">{title}</h1>
          </div>
        </section>

        <PresupuestoFilters
          search={search}
          setSearch={(v) => { setSearch(v); setPaginaActual(1); }}
          filtroActivo={filtroActivo}
          setFiltroActivo={setFiltroActivo}
          onNuevoPresupuesto={irANuevoPresupuesto}
          onExportarLista={exportarLista}
          theme={theme}
          puedeOperarMostrador={puedeOperarMostrador}
        />

        <PresupuestoTable
          pagedRows={pagedRows}
          status={status}
          loading={loading}
          isProcessing={isProcessing}
          theme={theme}
          onConfirmar={confirmar}
          onAbrirDetalle={abrirDetalle}
          onToggleMenu={toggleMenu}
          getRowBackground={getRowBackground}
        />

        <section className="flex flex-col items-center justify-center gap-4 py-4">
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              disabled={paginaActualSegura <= 1}
              onClick={() => setPaginaActual(Math.max(1, paginaActualSegura - 1))}
              className="group flex h-10 w-10 items-center justify-center rounded-xl border border-[#e5e7eb] bg-white text-[#475569] transition-all hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft className="h-5 w-5 transition-transform group-hover:-translate-x-0.5" />
            </button>
            {paginasVisibles.map((pagina) => (
              <button
                key={pagina}
                type="button"
                onClick={() => setPaginaActual(pagina)}
                className={`h-10 min-w-10 rounded-xl px-3 text-[14px] font-semibold transition-all ${pagina === paginaActualSegura ? theme.pageActive : "border border-[#e5e7eb] bg-white text-[#475569] hover:bg-slate-50"}`}
              >
                {pagina}
              </button>
            ))}
            <button
              type="button"
              disabled={paginaActualSegura >= totalPaginas}
              onClick={() => setPaginaActual(Math.min(totalPaginas, paginaActualSegura + 1))}
              className="group flex h-10 w-10 items-center justify-center rounded-xl border border-[#e5e7eb] bg-white text-[#475569] transition-all hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
          <p className="text-center text-[14px] text-[#64748b]">Mostrando {pagedRows.length} de {filteredRows.length} presupuesto/s</p>
        </section>
      </div>

      <PresupuestoModalsManager
        detalleAbierto={detalleAbierto}
        rowSeleccionada={rowSeleccionada}
        modoDetalle={modoDetalle}
        status={status}
        checkedItems={checkedItems}
        mostrarDetalleInfo={mostrarDetalleInfo}
        detailPageSafe={detailPageSafe}
        detailItems={detailItems}
        detailTotalPages={detailTotalPages}
        isProcessing={isProcessing}
        duplicarAbierto={duplicarAbierto}
        rowParaDuplicar={rowParaDuplicar}
        dialogAction={dialogAction}
        permissionToast={permissionToast}
        successToast={successToast}
        menuAbiertoId={menuAbiertoId}
        rowParaMenu={rowParaMenu}
        menuPosition={menuPosition}
        menuDirection={menuDirection}
        puedeOperarMostrador={puedeOperarMostrador}
        onCerrarDetalle={cerrarDetalle}
        setMostrarDetalleInfo={setMostrarDetalleInfo}
        setDetailPage={setDetailPage}
        toggleCheckedItem={toggleCheckedItem}
        onAgregarItemsAExistente={agregarItemsAExistente}
        onGuardarConfirmacionMostrador={guardarConfirmacionMostrador}
        onGuardarDetalleDeposito={guardarDetalleDeposito}
        onMarcarPresupuestoSeparado={marcarPresupuestoSeparado}
        onConfirmarDuplicar={confirmarDuplicar}
        setDuplicarAbierto={setDuplicarAbierto}
        onCerrarDialogo={cerrarDialogo}
        onConfirmarDialogo={confirmarDialogo}
        onAbrirDetalle={abrirDetalle}
        onEditarPresupuesto={editarPresupuesto}
        onAbrirDuplicar={abrirDuplicar}
        onRecotizar={recotizar}
        onExportarPDF={exportarPDF}
        onVolverAPendiente={volverAPendiente}
        onEliminarFila={eliminarFila}
        setMenuAbiertoId={setMenuAbiertoId}
        menuRef={menuRef}
      />
    </>
  );
}
