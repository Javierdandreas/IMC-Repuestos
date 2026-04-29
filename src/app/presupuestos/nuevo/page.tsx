"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { 
  BuscarRepuestos, 
  ClienteVehiculoForm, 
  type ClienteVehiculoData, 
  initialClienteVehiculoData, 
  ItemsPresupuestoTable, 
  PresupuestoActions,
  exportarPresupuestoPDF,
  type BuscarRepuestosHandle,
  CLIENTE_STORAGE_KEY,
  getEditorDraft,
  clearEditorDraft,
  isChasisValido,
  guardarPresupuestoSupabase,
  type EstadoPresupuesto,
  type PresupuestoCompleto,
  type PresupuestoEditorModo,
  type PresupuestoEditorSourceView,
  type PresupuestoItem,
  type ProductoCatalogo
} from "@/modules/presupuestos";
import { getUsuarioActual } from "@/modules/auth-presupuestos";
import { crearNotificacionSupabase } from "@/modules/notificaciones";
import { TriangleAlert } from "lucide-react";
import { useRef } from "react";

type EditorContext = {
  modo: PresupuestoEditorModo | null;
  presupuestoId: string | null;
  codigoOriginal: string | null;
  sourceView: PresupuestoEditorSourceView;
};

type PresupuestoPageState = {
  clienteVehiculo: ClienteVehiculoData;
  items: PresupuestoItem[];
  observaciones: string;
  estado: EstadoPresupuesto;
  editorContext: EditorContext;
};

const initialEditorContext: EditorContext = {
  modo: null,
  presupuestoId: null,
  codigoOriginal: null,
  sourceView: null,
};

function getInitialPageState(): PresupuestoPageState {
  if (typeof window === "undefined") {
    return {
      clienteVehiculo: { ...initialClienteVehiculoData },
      items: [],
      observaciones: "",
      estado: "pendiente",
      editorContext: initialEditorContext,
    };
  }

  try {
    const draft = getEditorDraft();

    if (draft) {
      return {
        clienteVehiculo: {
          cliente: draft.conservarCliente ? draft.presupuesto.cliente : "",
          telefono: draft.conservarCliente ? draft.presupuesto.telefono : "",
          referencia: draft.conservarCliente ? draft.presupuesto.referencia : "",
          marca: draft.conservarCliente ? draft.presupuesto.marca : "",
          modelo: draft.conservarCliente ? draft.presupuesto.modelo : "",
          chasis: draft.conservarCliente ? draft.presupuesto.chasis : "",
          patente: draft.conservarCliente ? draft.presupuesto.patente : "",
        },
        items: [...draft.presupuesto.items],
        observaciones: draft.presupuesto.observaciones ?? "",
        estado: draft.presupuesto.estado,
        editorContext: {
          modo: draft.modo,
          presupuestoId: draft.presupuesto.id,
          codigoOriginal: draft.presupuesto.codigo || null,
          sourceView: draft.sourceView ?? null,
        },
      };
    }

    const clienteGuardado = window.localStorage.getItem(CLIENTE_STORAGE_KEY);

    if (clienteGuardado) {
      const parsed = JSON.parse(clienteGuardado) as Partial<ClienteVehiculoData>;

      return {
        clienteVehiculo: {
          ...initialClienteVehiculoData,
          ...parsed,
        },
        items: [],
        observaciones: "",
        estado: "pendiente",
        editorContext: initialEditorContext,
      };
    }
  } catch (error) {
    console.error("Error al cargar datos iniciales del presupuesto:", error);
  }

  return {
    clienteVehiculo: { ...initialClienteVehiculoData },
    items: [],
    observaciones: "",
    estado: "pendiente",
    editorContext: initialEditorContext,
  };
}

function getRutaRetorno(
  sourceView: PresupuestoEditorSourceView,
  estado: EstadoPresupuesto
) {
  if (sourceView === "confirmados") {
    return "/presupuestos/confirmados";
  }

  if (sourceView === "pendientes") {
    return "/presupuestos/pendientes";
  }

  if (sourceView === "general") {
    return "/presupuestos/general";
  }

  return estado === "confirmado"
    ? "/presupuestos/confirmados"
    : "/presupuestos/pendientes";
}

export default function NuevoPresupuestoPage() {
  const router = useRouter();
  const [usuarioActual, setUsuarioActual] = useState<any>(null);
  const buscarRepuestosRef = useRef<BuscarRepuestosHandle>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setUsuarioActual(getUsuarioActual());
    }
  }, []);

  const [pageState, setPageState] = useState<PresupuestoPageState>(() =>
    getInitialPageState()
  );

  const [errorToast, setErrorToast] = useState<string | null>(null);

  const [toast, setToast] = useState<{
    visible: boolean;
    text: string;
    variant: "pendiente" | "confirmado";
  }>({
    visible: false,
    text: "",
    variant: "pendiente",
  });

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { clienteVehiculo, items, observaciones, estado, editorContext } =
    pageState;

  const total = useMemo(() => {
    return items.reduce((acc, item) => acc + item.cantidad * item.precio, 0);
  }, [items]);

  const setClienteVehiculo = (next: ClienteVehiculoData) => {
    setPageState((prev) => ({
      ...prev,
      clienteVehiculo: next,
    }));
  };

  const setObservaciones = (next: string) => {
    setPageState((prev) => ({
      ...prev,
      observaciones: next,
    }));
  };

  const setEstado = (next: EstadoPresupuesto) => {
    setPageState((prev) => ({
      ...prev,
      estado: next,
    }));
  };

  const agregarItem = (producto: ProductoCatalogo, cantidad: number) => {
    setPageState((prev) => {
      const existente = prev.items.find(
        (item) => item.codigo === producto.codigo
      );

      if (existente) {
        return {
          ...prev,
          items: prev.items.map((item) =>
            item.codigo === producto.codigo
              ? { ...item, cantidad: item.cantidad + cantidad }
              : item
          ),
        };
      }

      return {
        ...prev,
        items: [
          ...prev.items,
          {
            codigo: producto.codigo,
            descripcion: producto.descripcion,
            marca: producto.marca,
            cantidad,
            precio: producto.precio,
            stock: producto.stock,
            ubicacion: producto.ubicacion,
            estadoDepositoItem: "pendiente",
          },
        ],
      };
    });
  };

  const eliminarItem = (codigo: string) => {
    setPageState((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.codigo !== codigo),
    }));
  };

  const actualizarCantidad = (codigo: string, cantidad: number) => {
    setPageState((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.codigo === codigo
          ? { ...item, cantidad: cantidad > 0 ? cantidad : 1 }
          : item
      ),
    }));
  };

  const actualizarPrecio = (codigo: string, precio: number) => {
    setPageState((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.codigo === codigo
          ? { ...item, precio: precio >= 0 ? precio : item.precio }
          : item
      ),
    }));
  };

  const limpiarFormulario = () => {
    setPageState({
      clienteVehiculo: { ...initialClienteVehiculoData },
      items: [],
      observaciones: "",
      estado: "pendiente",
      editorContext: initialEditorContext,
    });

    try {
      window.localStorage.removeItem(CLIENTE_STORAGE_KEY);
      clearEditorDraft();
    } catch (error) {
      console.error("Error al limpiar datos del cliente:", error);
    }
  };

  const mostrarErrorToast = (mensaje: string) => {
    setErrorToast(mensaje);
    window.setTimeout(() => {
      setErrorToast(null);
    }, 2800);
  };

  const mostrarPermisoDenegado = () => {
    mostrarErrorToast("Su usuario no tiene permitido hacer esta acción");
  };

  const mostrarToast = (
    estadoFinal: EstadoPresupuesto,
    modo?: PresupuestoEditorModo | null
  ) => {
    const variant = estadoFinal === "confirmado" ? "confirmado" : "pendiente";

    let text =
      estadoFinal === "confirmado"
        ? "Presupuesto guardado en Confirmados."
        : "Presupuesto guardado en Pendientes.";

    if (modo === "editar") {
      text = "Presupuesto actualizado correctamente.";
    }

    if (modo === "duplicar") {
      text = "Presupuesto duplicado y guardado correctamente.";
    }

    if (modo === "recotizar") {
      text = "Presupuesto recotizado y actualizado correctamente.";
    }

    setToast({
      visible: true,
      text,
      variant,
    });

    window.setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 2200);
  };

  const guardar = async (estadoFinal: EstadoPresupuesto) => {
    const usuarioActual = getUsuarioActual();
    if (usuarioActual?.rol === "deposito") {
      mostrarPermisoDenegado();
      return;
    }

    if (items.length === 0) {
      mostrarErrorToast("Agregá al menos un ítem antes de guardar.");
      return;
    }

    if (
      clienteVehiculo.chasis.trim() !== "" &&
      !isChasisValido(clienteVehiculo.chasis)
    ) {
      mostrarErrorToast(
        "El chasis debe tener 17 caracteres alfanuméricos válidos."
      );
      return;
    }

    if (isSaving) return;

    try {
      setIsSaving(true);
      const payloadBase = {
        presupuestoId:
          editorContext.modo === "editar" && editorContext.presupuestoId
            ? editorContext.presupuestoId
            : undefined,
        codigoOriginal:
          editorContext.modo === "editar" && editorContext.codigoOriginal
            ? editorContext.codigoOriginal
            : undefined,
        cliente: clienteVehiculo.cliente,
        telefono: clienteVehiculo.telefono,
        referencia: clienteVehiculo.referencia,
        marca: clienteVehiculo.marca,
        modelo: clienteVehiculo.modelo,
        chasis: clienteVehiculo.chasis,
        patente: clienteVehiculo.patente,
        items,
        observaciones,
        total,
        estado: estadoFinal,
        confirmadoAt:
          estadoFinal === "confirmado" ? new Date().toISOString() : undefined,
        estadoDeposito: "sin_revisar" as const,
        vendedorNombre: usuarioActual?.nombre || null,
      };

      const result = await guardarPresupuestoSupabase(payloadBase);

      if (estadoFinal === "confirmado" && usuarioActual) {
        try {
          await crearNotificacionSupabase({
            userRole: "deposito",
            titulo: `${payloadBase.cliente || "CLIENTE"} listo para preparación`,
            mensaje: `El presupuesto de ${payloadBase.cliente || "ESTE CLIENTE"} fue confirmado y ya puede ser separado.`,
            tipo: "confirmacion",
            presupuestoId: String(result.presupuestoId),
            codigoOP: result.codigoInterno,
          });
        } catch (notifError) {
          console.warn("Se ignoró el error al crear la notificación:", notifError);
        }
      }

      setEstado(estadoFinal);
      mostrarToast(estadoFinal, editorContext.modo);
      limpiarFormulario();

      // Limpiar el buscador de repuestos también
      buscarRepuestosRef.current?.clear();

      window.setTimeout(() => {
        document.getElementById("main-content-area")?.scrollTo({ top: 0, behavior: "smooth" });
      }, 450);
    } catch (error) {
      console.error("Error al guardar el presupuesto en Supabase:", error);
      mostrarErrorToast("Ocurrió un error al guardar el presupuesto de forma segura.");
    } finally {
      setIsSaving(false);
    }
  };

  const getCancelDialogText = () => {
    if (editorContext.modo === "duplicar") {
      return "¿Querés cancelar este duplicado? Se limpiarán los datos cargados y volverás al listado.";
    }

    if (editorContext.modo === "recotizar") {
      return "¿Querés cancelar esta recotización? Se limpiarán los datos cargados y volverás al listado.";
    }

    if (editorContext.modo === "editar") {
      return "¿Querés cancelar esta edición? Se limpiarán los datos cargados y volverás al listado.";
    }

    return "¿Querés cancelar? Se limpiarán los datos cargados y volverás al listado.";
  };

  const handleTransicionABusqueda = () => {
    // 1. Scroll suave hacia el buscador
    const searchSection = document.getElementById("seccion-busqueda-repuestos");
    if (searchSection) {
      searchSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    // 2. Esperar un poquito a que termine el scroll y dar foco
    window.setTimeout(() => {
      buscarRepuestosRef.current?.focus();
    }, 800);
  };

  const cancelarEdicion = () => {
    setCancelDialogOpen(true);
  };

  const confirmarCancelacion = () => {
    setCancelDialogOpen(false);
    limpiarFormulario();
    router.push(getRutaRetorno(editorContext.sourceView, estado));
  };

  const exportarBorrador = async () => {
    if (items.length === 0) {
      mostrarErrorToast("Agregá al menos un ítem antes de exportar el PDF.");
      return;
    }

    if (
      clienteVehiculo.chasis.trim() !== "" &&
      !isChasisValido(clienteVehiculo.chasis)
    ) {
      mostrarErrorToast(
        "Corregí el chasis antes de exportar el PDF. Debe tener 17 caracteres alfanuméricos."
      );
      return;
    }

    try {
      const presupuestoTemporal: PresupuestoCompleto = {
        id: editorContext.presupuestoId ?? "borrador",
        codigo: editorContext.codigoOriginal ?? "",
        fecha: new Date().toISOString(),
        cliente: clienteVehiculo.cliente.trim().toUpperCase() || "SIN CLIENTE",
        telefono: clienteVehiculo.telefono.trim(),
        referencia: clienteVehiculo.referencia.trim().toUpperCase(),
        marca: clienteVehiculo.marca.trim().toUpperCase(),
        modelo: clienteVehiculo.modelo.trim().toUpperCase(),
        chasis: clienteVehiculo.chasis.trim(),
        patente: clienteVehiculo.patente.trim().toUpperCase(),
        items,
        observaciones,
        total,
        estado,
        estadoDeposito: "sin_revisar",
      };

      await exportarPresupuestoPDF(presupuestoTemporal);
    } catch (error) {
      console.error("Error al exportar el PDF:", error);
      mostrarErrorToast("No se pudo exportar el PDF.");
    }
  };

  return (
    <div className="space-y-4">
      <ClienteVehiculoForm
        value={clienteVehiculo}
        onChange={setClienteVehiculo}
        onPermissionDenied={mostrarPermisoDenegado}
        onSave={handleTransicionABusqueda}
      />

      <div id="seccion-busqueda-repuestos" className="pt-2">
        <BuscarRepuestos
          ref={buscarRepuestosRef}
          onAgregarItem={agregarItem}
        />
      </div>

      <ItemsPresupuestoTable
        items={items}
        observaciones={observaciones}
        total={total}
        onChangeObservaciones={setObservaciones}
        onEliminarItem={eliminarItem}
        onActualizarCantidad={actualizarCantidad}
        onActualizarPrecio={actualizarPrecio}
      />

      <div className={isSaving ? "opacity-50 pointer-events-none" : ""}>
        <PresupuestoActions
          estado={estado}
          modoEdicion={editorContext.modo}
          onGuardarPresupuesto={guardar}
          onExportarPDF={exportarBorrador}
          onCancelar={cancelarEdicion}
          isSaving={isSaving}
        />
      </div>

      {toast.visible && typeof document !== "undefined" && createPortal(
        <div className="fixed bottom-5 right-5 z-[80]">
          <div
            className={`rounded-2xl px-5 py-3 text-[14px] font-medium text-white shadow-lg ${toast.variant === "confirmado"
                ? "bg-[#57b970]"
                : "bg-[#c27c17]"
              }`}
          >
            {toast.text}
          </div>
        </div>,
        document.body
      )}

      {cancelDialogOpen && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[85] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setCancelDialogOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[22px] font-bold text-[#243047]">Cancelar</h3>
            <p className="mt-2 text-[14px] text-[#64748b]">
              {getCancelDialogText()}
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCancelDialogOpen(false)}
                className="rounded-2xl border border-[#e5e7eb] bg-white px-4 py-3 text-[14px] font-semibold text-[#243047] hover:bg-slate-50 transition-colors"
              >
                Seguir editando
              </button>

              <button
                type="button"
                onClick={confirmarCancelacion}
                className="rounded-2xl bg-[#b34747] px-4 py-3 text-[14px] font-semibold text-white hover:opacity-90 transition-opacity"
              >
                Sí, cancelar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {errorToast && typeof document !== "undefined" && createPortal(
        <div className="fixed bottom-5 right-5 z-[100] flex items-center gap-3 rounded-2xl border border-[#f4d6d6] bg-white px-4 py-3 shadow-lg animate-in slide-in-from-right duration-300">
          <TriangleAlert className="h-5 w-5 text-[#b54747]" />
          <span className="text-[14px] font-medium text-[#7a2e2e]">
            {errorToast}
          </span>
        </div>,
        document.body
      )}
    </div>
  );
}