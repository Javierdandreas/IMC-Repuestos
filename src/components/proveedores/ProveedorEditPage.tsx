"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HiArrowLeft, HiSave } from "react-icons/hi";
import { useAppError } from "@/context/AppErrorContext";

import { ProveedorImportHistory } from "@/components/proveedores/ProveedorImportHistory";
import { ProveedorImportSection } from "@/components/proveedores/ProveedorImportSection";
import { ProveedorLocationFields } from "@/components/proveedores/ProveedorLocationFields";
import type { CatalogoItem } from "@/interfaces/productos";

type Props = {
  proveedor?: CatalogoItem;
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

export function ProveedorEditPage({ proveedor }: Props) {
  const router = useRouter();
  const { showMessage } = useAppError();
  const isEditing = Boolean(proveedor);
  const [descripcion, setDescripcion] = useState((proveedor?.descripcion ?? "").toUpperCase());
  const [documento, setDocumento] = useState((proveedor?.documento ?? "").toUpperCase());
  const [condicionIva, setCondicionIva] = useState((proveedor?.condicion_iva ?? "").toUpperCase());
  const [comprobanteDefault, setComprobanteDefault] = useState((proveedor?.comprobante_default ?? "").toUpperCase());
  const [contacto, setContacto] = useState(proveedor?.contacto ?? "");
  const [telefono, setTelefono] = useState(proveedor?.telefono ?? "");
  const [email, setEmail] = useState(proveedor?.email ?? "");
  const [domicilioFiscal, setDomicilioFiscal] = useState(proveedor?.domicilio_fiscal ?? "");
  const [provincia, setProvincia] = useState(proveedor?.provincia ?? "");
  const [localidad, setLocalidad] = useState(proveedor?.localidad ?? "");
  const [codigoPostal, setCodigoPostal] = useState(proveedor?.codigo_postal ?? "");
  const [activo, setActivo] = useState(proveedor?.activo ?? true);
  const [observaciones, setObservaciones] = useState(proveedor?.observaciones ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (saving) return;

    try {
      setSaving(true);

      const response = await fetch(isEditing ? `/api/catalogos/proveedores/${proveedor?.id}` : "/api/catalogos/proveedores", {
        method: isEditing ? "PUT" : "POST",
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

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "No se pudo guardar el proveedor");
      }

      toast.success(isEditing ? "Proveedor guardado correctamente" : "Proveedor creado correctamente");
      router.push("/proveedores");
      router.refresh();
    } catch (error) {
      showMessage(
        error instanceof Error ? error.message : `No se pudo ${isEditing ? "guardar" : "crear"} el proveedor`,
        `No se pudo ${isEditing ? "guardar" : "crear"} el proveedor`
      );
    } finally {
      setSaving(false);
    }
  }, [activo, codigoPostal, comprobanteDefault, condicionIva, contacto, descripcion, domicilioFiscal, documento, email, isEditing, localidad, observaciones, proveedor?.id, provincia, router, saving, showMessage, telefono]);

  const sectionClass = "rounded-2xl border border-slate-800 bg-[#0f172a] p-4 shadow-sm";
  const labelClass = "text-[10px] font-black uppercase tracking-widest text-blue-400";
  const inputClass = "h-10 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 text-xs font-black uppercase text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10";
  const textInputClass = "h-10 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 text-xs font-bold text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10";

  return (
    <div className="min-h-screen px-4 py-5 md:px-6">
      <div className="mx-auto w-full max-w-[1500px]">
        <div className="mb-3">
          <Link
            href="/proveedores"
            className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500 transition hover:text-blue-500 dark:text-slate-400"
          >
            <HiArrowLeft className="h-4 w-4" />
            Volver a proveedores
          </Link>
        </div>

        <header className="mb-4 flex items-center justify-between rounded-2xl border border-slate-800 bg-[#0f172a] p-4 shadow-sm">
          <div className="min-w-0">
            <h1 className="truncate text-base font-black text-white">{isEditing ? "Editar proveedor" : "Nuevo proveedor"}</h1>
            <p className="truncate text-[11px] font-bold uppercase tracking-wider text-slate-500">{isEditing ? proveedor?.descripcion : "Completa los datos para registrar el proveedor"}</p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 disabled:opacity-60 active:scale-95"
          >
            <HiSave className="h-4 w-4" />
            {saving ? "Guardando..." : isEditing ? "Guardar cambios" : "Crear proveedor"}
          </button>
        </header>

        <section className={sectionClass}>
          <h2 className="mb-3 text-[11px] font-black uppercase tracking-widest text-white">Informacion general</h2>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1.5">
              <label className={labelClass}>Nombre</label>
              <input
                type="text"
                value={descripcion}
                onChange={(event) => setDescripcion(event.target.value.toUpperCase())}
                className={inputClass}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>CUIT / DNI</label>
              <input
                type="text"
                value={documento}
                onChange={(event) => setDocumento(event.target.value)}
                className={inputClass}
                placeholder="20-12345678-9 o 12345678"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Condicion IVA</label>
              <select
                value={condicionIva}
                onChange={(event) => setCondicionIva(event.target.value)}
                className={inputClass}
              >
                {IVA_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Comprobante default</label>
              <select
                value={comprobanteDefault}
                onChange={(event) => setComprobanteDefault(event.target.value)}
                className={inputClass}
              >
                {COMPROBANTE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className={`mt-4 ${sectionClass}`}>
          <h2 className="mb-3 text-[11px] font-black uppercase tracking-widest text-white">Contacto y domicilio fiscal</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <label className={labelClass}>Contacto principal</label>
              <input type="text" value={contacto} onChange={(event) => setContacto(event.target.value)} className={textInputClass} placeholder="Nombre y apellido" />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Telefono</label>
              <input type="tel" value={telefono} onChange={(event) => setTelefono(event.target.value)} className={textInputClass} placeholder="Telefono o WhatsApp" />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Email</label>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={textInputClass} placeholder="correo@proveedor.com" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className={labelClass}>Domicilio fiscal</label>
              <input type="text" value={domicilioFiscal} onChange={(event) => setDomicilioFiscal(event.target.value)} className={textInputClass} placeholder="Calle, numero y piso" />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Codigo postal</label>
              <input type="text" value={codigoPostal} onChange={(event) => setCodigoPostal(event.target.value)} className={textInputClass} placeholder="Codigo postal" />
            </div>
            <ProveedorLocationFields
              provincia={provincia}
              localidad={localidad}
              activo={activo}
              onProvinciaChange={setProvincia}
              onLocalidadChange={setLocalidad}
              onActivoChange={setActivo}
              labelClass={labelClass}
              selectClass={textInputClass}
            />
          </div>
        </section>

        <section className={`mt-4 ${sectionClass}`}>
          <div className="space-y-1.5">
            <label className={labelClass}>Observaciones</label>
            <textarea value={observaciones} onChange={(event) => setObservaciones(event.target.value)} className="min-h-20 w-full resize-y rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-medium text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10" placeholder="Notas internas sobre el proveedor" />
          </div>
        </section>

        {proveedor ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <section className={sectionClass}>
              <h2 className="mb-3 text-[11px] font-black uppercase tracking-widest text-white">Importar lista de precios</h2>
              <ProveedorImportSection id_proveedor={proveedor.id} nombre_proveedor={descripcion} hideHistory compact />
            </section>

            <section className={sectionClass}>
              <h2 className="mb-3 text-[11px] font-black uppercase tracking-widest text-white">Ultimas importaciones</h2>
              <ProveedorImportHistory id_proveedor={proveedor.id} compact />
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}
