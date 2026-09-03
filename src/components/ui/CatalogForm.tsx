"use client";

import { type ReactNode, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HiSave } from "react-icons/hi";
import { useAppError } from "@/context/AppErrorContext";

import { ProveedorImportSection } from "@/components/proveedores/ProveedorImportSection";
import { ProveedorImportHistory } from "@/components/proveedores/ProveedorImportHistory";
import { ProveedorDiscountSettings } from "@/components/proveedores/ProveedorDiscountSettings";

type Props = {
  /** Ruta base de la API (ej: "/api/marcas", "/api/categorias") */
  apiPath: string;
  /** Nombre de la entidad para mensajes (ej: "marca", "categoría") */
  entityName: string;
  /** Placeholder del input (ej: "Ingresar marca") */
  placeholder?: string;
  /** ID para modo edición */
  entityId?: number;
  /** Valor inicial de la descripción */
  initialDescripcion?: string;
  initialDocumento?: string | null;
  initialCondicionIva?: string | null;
  initialComprobanteDefault?: string | null;
  initialContacto?: string | null;
  initialTelefono?: string | null;
  initialEmail?: string | null;
  initialDomicilioFiscal?: string | null;
  initialProvincia?: string | null;
  initialLocalidad?: string | null;
  initialCodigoPostal?: string | null;
  initialActivo?: boolean | null;
  initialObservaciones?: string | null;
  /** Callback al guardar con éxito */
  onSuccess?: () => void;
  /** Callback al cancelar */
  onCancel?: () => void;
  /** Prop para disparar el guardado desde afuera (usado para el botón en el header del modal) */
  triggerSave?: number;
};

const IVA_OPTIONS = [
  { value: "", label: "Sin definir" },
  { value: "RESPONSABLE_INSCRIPTO", label: "Responsable inscripto" },
  { value: "MONOTRIBUTO", label: "Monotributo" },
  { value: "EXENTO", label: "Exento" },
  { value: "CONSUMIDOR_FINAL", label: "Consumidor final" },
  { value: "NO_RESPONSABLE", label: "No responsable" },
];

const COMPROBANTE_OPTIONS = [
  { value: "", label: "Sin definir" },
  { value: "FACTURA_A", label: "Factura A" },
  { value: "FACTURA_B", label: "Factura B" },
];

/**
 * Formulario genérico para entidades de catálogo simples (marcas, proveedores, categorías).
 * Maneja creación y edición de registros con un solo campo "descripcion".
 * En el caso de Proveedores, integra también la gestión de descuentos.
 */
export function CatalogForm({
  apiPath,
  entityName,
  placeholder,
  entityId,
  initialDescripcion = "",
  initialDocumento = "",
  initialCondicionIva = "",
  initialComprobanteDefault = "",
  initialContacto = "",
  initialTelefono = "",
  initialEmail = "",
  initialDomicilioFiscal = "",
  initialProvincia = "",
  initialLocalidad = "",
  initialCodigoPostal = "",
  initialActivo = true,
  initialObservaciones = "",
  onSuccess,
  onCancel,
  triggerSave,
}: Props) {
  const router = useRouter();
  const { showMessage } = useAppError();
  const [descripcion, setDescripcion] = useState(initialDescripcion.toUpperCase());
  const [documento, setDocumento] = useState((initialDocumento ?? "").toUpperCase());
  const [condicionIva, setCondicionIva] = useState((initialCondicionIva ?? "").toUpperCase());
  const [comprobanteDefault, setComprobanteDefault] = useState((initialComprobanteDefault ?? "").toUpperCase());
  const [contacto, setContacto] = useState(initialContacto ?? "");
  const [telefono, setTelefono] = useState(initialTelefono ?? "");
  const [email, setEmail] = useState(initialEmail ?? "");
  const [domicilioFiscal, setDomicilioFiscal] = useState(initialDomicilioFiscal ?? "");
  const [provincia, setProvincia] = useState(initialProvincia ?? "");
  const [localidad, setLocalidad] = useState(initialLocalidad ?? "");
  const [codigoPostal, setCodigoPostal] = useState(initialCodigoPostal ?? "");
  const [activo, setActivo] = useState(initialActivo ?? true);
  const [observaciones, setObservaciones] = useState(initialObservaciones ?? "");
  const [loading, setLoading] = useState(false);

  // Estados para descuentos (solo proveedores)
  const [descuentoGeneral, setDescuentoGeneral] = useState<number>(0);
  const [descuentosPorMarca, setDescuentosPorMarca] = useState<Record<number, number>>({});

  const isEditing = Boolean(entityId);
  const isProveedor = entityName.toLowerCase() === "proveedor";

  // Cargar descuentos si es proveedor
  useEffect(() => {
    if (isEditing && isProveedor && entityId) {
      fetch(`/api/proveedores/${entityId}/descuentos`)
        .then(res => res.json())
        .then(data => {
          setDescuentoGeneral(data.descuentoGeneral || 0);
          setDescuentosPorMarca(data.descuentosPorMarca || {});
        })
        .catch(() => console.error("Error al cargar descuentos"));
    }
  }, [entityId, isEditing, isProveedor]);

  const handleGlobalSave = useCallback(async () => {
    if (loading) return;
    setLoading(true);

    try {
      // 1. Guardar Nombre
      const url = isEditing ? `${apiPath}/${entityId}` : apiPath;
      const method = isEditing ? "PUT" : "POST";

      const resName = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descripcion,
          documento,
          condicion_iva: condicionIva,
          comprobante_default: comprobanteDefault,
          contacto,
          telefono,
          email,
          domicilio_fiscal: domicilioFiscal,
          provincia,
          localidad,
          codigo_postal: codigoPostal,
          activo,
          observaciones,
        }),
      });

      if (!resName.ok) {
        const data = await resName.json();
        throw new Error(data.message || "Error al guardar el nombre");
      }

      // 2. Guardar Descuentos (si es proveedor y edición)
      if (isEditing && isProveedor && entityId) {
        const resDiscounts = await fetch(`/api/proveedores/${entityId}/descuentos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            descuentoGeneral,
            descuentosPorMarca
          })
        });

        if (!resDiscounts.ok) {
          throw new Error("El nombre se guardó, pero hubo un error con los descuentos.");
        }
      }

      toast.success("Cambios guardados correctamente");
      
      if (onSuccess) {
        onSuccess();
      }
      router.refresh();
    } catch (error: unknown) {
      showMessage(
        error instanceof Error ? error.message : `No se pudo guardar ${entityName}`,
        `No se pudo guardar ${entityName}`
      );
    } finally {
      setLoading(false);
    }
  }, [activo, apiPath, codigoPostal, comprobanteDefault, condicionIva, contacto, descripcion, descuentoGeneral, descuentosPorMarca, domicilioFiscal, documento, email, entityId, entityName, isEditing, isProveedor, loading, localidad, observaciones, onSuccess, provincia, router, showMessage, telefono]);

  // Escuchar trigger externo
  useEffect(() => {
    if (triggerSave && triggerSave > 0) {
      handleGlobalSave();
    }
  }, [triggerSave, handleGlobalSave]);

  const renderProviderEdit = () => {
    if (!isEditing || !isProveedor || !entityId) return null;

    return (
      <div className="py-5">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(360px,0.8fr)_minmax(520px,1.2fr)] animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* COLUMNA IZQUIERDA */}
          <div className="flex flex-col gap-4">
            {/* Información General */}
            <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-5 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <h3 className="text-sm font-black uppercase tracking-widest text-white">Información General</h3>
                <div className="h-px flex-1 bg-slate-800" />
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block px-1 text-[10px] font-black uppercase tracking-widest text-blue-400">Nombre del Proveedor</label>
                  <input
                    type="text"
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value.toUpperCase())}
                    className="h-12 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 text-sm font-black uppercase text-white shadow-inner outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                    placeholder={placeholder ?? `Ingresar ${entityName}`}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Configuración de Descuentos */}
            <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-5 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <h3 className="text-sm font-black uppercase tracking-widest text-white">Configuración de Descuentos</h3>
                <div className="h-px flex-1 bg-slate-800" />
              </div>
              <ProveedorDiscountSettings 
                id_proveedor={entityId} 
                externalState={{
                  descuentoGeneral,
                  setDescuentoGeneral,
                  descuentosPorMarca,
                  setDescuentosPorMarca
                }}
              />
            </div>
          </div>

          {/* COLUMNA DERECHA */}
          <div className="flex flex-col gap-4">
            {/* Asistente de Importación */}
            <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-5 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <h3 className="text-sm font-black uppercase tracking-widest text-white">Asistente de Importación</h3>
                <div className="h-px flex-1 bg-slate-800" />
              </div>
              <ProveedorImportSection 
                id_proveedor={entityId} 
                nombre_proveedor={initialDescripcion}
                hideHistory
              />
            </div>

            {/* Historial de Importaciones */}
            <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-5 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <h3 className="text-sm font-black uppercase tracking-widest text-white">Historial de Importaciones</h3>
                <div className="h-px flex-1 bg-slate-800" />
              </div>
              <div className="max-h-[360px] overflow-y-auto pr-2 custom-scrollbar">
                <ProveedorImportHistory id_proveedor={entityId} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (isEditing && isProveedor) {
    return renderProviderEdit();
  }

  return (
    <div className="flex flex-col gap-10">
      <form onSubmit={(e) => { e.preventDefault(); handleGlobalSave(); }} className="rounded-3xl border border-slate-200 bg-slate-50/30 p-6 dark:border-slate-800 dark:bg-slate-900/20">
        <div className="mb-6">
          <label className="block mb-2 text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Nombre del {entityName}</label>
          <input
            type="text"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value.toUpperCase())}
            className="w-full border rounded-xl p-3 uppercase outline-none transition border-slate-200 bg-white text-slate-900 font-bold focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            placeholder={placeholder ?? `Ingresar ${entityName}`}
            required
          />
        </div>

        {isProveedor && (
          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <div>
              <label className="block mb-2 text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">CUIT / DNI</label>
              <input
                type="text"
                value={documento}
                onChange={(event) => setDocumento(event.target.value)}
                className="w-full border rounded-xl p-3 uppercase outline-none transition border-slate-200 bg-white text-slate-900 font-bold focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                placeholder="20-12345678-9 o 12345678"
                inputMode="numeric"
              />
            </div>
            <div>
              <label className="block mb-2 text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Condicion IVA</label>
              <select
                value={condicionIva}
                onChange={(event) => setCondicionIva(event.target.value)}
                className="w-full border rounded-xl p-3 uppercase outline-none transition border-slate-200 bg-white text-slate-900 font-bold focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              >
                {IVA_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block mb-2 text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Comprobante default</label>
              <select
                value={comprobanteDefault}
                onChange={(event) => setComprobanteDefault(event.target.value)}
                className="w-full border rounded-xl p-3 uppercase outline-none transition border-slate-200 bg-white text-slate-900 font-bold focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              >
                {COMPROBANTE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {isProveedor && (
          <div className="mb-6 border-t border-slate-200 pt-5 dark:border-slate-800">
            <h3 className="mb-4 text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Contacto y domicilio</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <ProviderContactField label="Contacto principal"><input type="text" value={contacto} onChange={(event) => setContacto(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100" placeholder="Nombre y apellido" /></ProviderContactField>
              <ProviderContactField label="Telefono"><input type="tel" value={telefono} onChange={(event) => setTelefono(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100" placeholder="Telefono o WhatsApp" /></ProviderContactField>
              <ProviderContactField label="Email"><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100" placeholder="correo@proveedor.com" /></ProviderContactField>
              <ProviderContactField label="Domicilio fiscal" className="md:col-span-2"><input type="text" value={domicilioFiscal} onChange={(event) => setDomicilioFiscal(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100" placeholder="Calle, numero y piso" /></ProviderContactField>
              <ProviderContactField label="Codigo postal"><input type="text" value={codigoPostal} onChange={(event) => setCodigoPostal(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100" placeholder="Codigo postal" /></ProviderContactField>
              <ProviderContactField label="Provincia"><input type="text" value={provincia} onChange={(event) => setProvincia(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100" placeholder="Provincia" /></ProviderContactField>
              <ProviderContactField label="Localidad"><input type="text" value={localidad} onChange={(event) => setLocalidad(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100" placeholder="Localidad" /></ProviderContactField>
              <label className="flex h-11 items-center justify-between rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
                Activo
                <input type="checkbox" checked={activo} onChange={(event) => setActivo(event.target.checked)} className="h-4 w-4 accent-blue-600" />
              </label>
              <textarea value={observaciones} onChange={(event) => setObservaciones(event.target.value)} className="min-h-20 rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 md:col-span-3 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100" placeholder="Observaciones" />
            </div>
          </div>
        )}

        {(!isProveedor || !isEditing) && (
          <div className="flex items-center justify-end gap-3">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
            )}

            <button
              type="submit"
              disabled={loading}
              className="bg-slate-900 text-white px-8 py-2.5 rounded-xl font-bold text-sm transition hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 shadow-lg"
            >
              {loading ? "Guardando..." : isEditing ? "Actualizar nombre" : "Guardar"}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

function ProviderContactField({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`space-y-1.5 ${className}`}>
      <span className="block text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{label}</span>
      {children}
    </label>
  );
}
