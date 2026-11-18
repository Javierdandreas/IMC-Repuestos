"use client";

import { useCallback, useId, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HiEye, HiEyeOff, HiPencil, HiPlus, HiSave, HiSearch } from "react-icons/hi";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { usePermissions } from "@/components/auth/usePermissions";
import type { CatalogoItem, TipoPrecio, Subcategoria } from "@/interfaces/productos";
import type { Cliente, ClienteInput } from "@/lib/repos/clientes";
import type { ReglaDescuentoCliente } from "@/lib/descuentos-cliente";
import { ClienteDiscountRules } from "@/components/clientes/ClienteDiscountRules";

type Props = {
  clientes: Cliente[];
  totalPages: number;
  totalCount: number;
  marcas: CatalogoItem[];
  tiposPrecio: TipoPrecio[];
  categorias: CatalogoItem[];
  subcategorias: Subcategoria[];
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

function fiscalLabel(value: string | null) {
  return value ? value.replaceAll("_", " ") : "-";
}

function documentLabel(cliente: Cliente) {
  if (!cliente.documento) return "-";
  return `${cliente.tipo_documento ?? "Doc."} ${cliente.documento}`;
}

function emptyCliente(): ClienteInput {
  return {
    razon_social: "",
    tipo_persona: "FISICA",
    tipo_documento: "DNI",
    documento: "",
    condicion_iva: "CONSUMIDOR_FINAL",
    comprobante_default: "FACTURA_B",
    domicilio: "",
    localidad: "",
    provincia: "",
    codigo_postal: "",
    telefono: "",
    celular: "",
    email: "",
    contacto_nombre: "",
    contacto_telefono: "",
    contacto_celular: "",
    contacto_email: "",
    id_tipo_precio: "",
    bonificacion_general: 0,
    activo: true,
    descuentos_marca: [],
    reglas_descuento: [],
  };
}

function inputFromCliente(cliente: Cliente): ClienteInput {
  return {
    razon_social: cliente.razon_social,
    tipo_persona: cliente.tipo_persona,
    tipo_documento: cliente.tipo_documento ?? "",
    documento: cliente.documento ?? "",
    condicion_iva: cliente.condicion_iva ?? "",
    comprobante_default: cliente.comprobante_default ?? "",
    domicilio: cliente.domicilio ?? "",
    localidad: cliente.localidad ?? "",
    provincia: cliente.provincia ?? "",
    codigo_postal: cliente.codigo_postal ?? "",
    telefono: cliente.telefono ?? "",
    celular: cliente.celular ?? "",
    email: cliente.email ?? "",
    contacto_nombre: cliente.contacto_nombre ?? "",
    contacto_telefono: cliente.contacto_telefono ?? "",
    contacto_celular: cliente.contacto_celular ?? "",
    contacto_email: cliente.contacto_email ?? "",
    id_tipo_precio: cliente.id_tipo_precio ?? "",
    bonificacion_general: cliente.bonificacion_general,
    activo: cliente.activo,
    descuentos_marca: cliente.descuentos_marca.map(({ id_marca, descuento }) => ({ id_marca, descuento })),
    reglas_descuento: cliente.reglas_descuento,
  };
}

export function ClientesPage({ clientes, totalPages, totalCount, marcas, tiposPrecio, categorias, subcategorias }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canManage } = usePermissions();
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [creating, setCreating] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const updateParams = (changes: Record<string, string>) => {
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(changes).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    next.set("page", "1");
    router.push(`/clientes?${next.toString()}`);
  };

  const toggleActive = async (cliente: Cliente) => {
    try {
      setUpdatingId(cliente.id);
      const response = await fetch(`/api/clientes/${cliente.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...inputFromCliente(cliente), activo: !cliente.activo }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "No se pudo actualizar el estado.");
      toast.success(cliente.activo ? "Cliente desactivado." : "Cliente activado.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar el estado.");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5 px-4 py-6 md:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Clientes</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{totalCount.toLocaleString("es-AR")} clientes registrados</p>
        </div>
        {canManage ? <button type="button" onClick={() => setCreating(true)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-black uppercase tracking-widest text-white transition hover:bg-blue-500"><HiPlus className="h-4 w-4" />Nuevo cliente</button> : null}
      </header>

      <section className="grid gap-3 border-y border-slate-200 py-4 dark:border-slate-800 md:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-1">
          <span className="block text-[9px] font-black uppercase tracking-widest text-slate-500">Buscar</span>
          <span className="relative block">
            <HiSearch className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input defaultValue={searchParams.get("q") ?? ""} onChange={(event) => updateParams({ q: event.target.value.trim() })} placeholder="Buscar nombre, documento o contacto" className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs font-bold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
          </span>
        </label>
        <FilterSelect value={searchParams.get("tipoPersona") ?? ""} onChange={(value) => updateParams({ tipoPersona: value })} label="Tipo" options={[{ value: "", label: "Todas las personas" }, { value: "FISICA", label: "Fisica" }, { value: "JURIDICA", label: "Juridica" }]} />
        <FilterSelect value={searchParams.get("condicionIva") ?? ""} onChange={(value) => updateParams({ condicionIva: value })} label="Condicion fiscal" options={IVA_OPTIONS} />
        <FilterSelect value={searchParams.get("idTipoPrecio") ?? ""} onChange={(value) => updateParams({ idTipoPrecio: value })} label="Lista" options={[{ value: "", label: "Todas las listas" }, ...tiposPrecio.map((item) => ({ value: String(item.id), label: item.descripcion }))]} />
        <FilterSelect value={searchParams.get("bonificacion") ?? ""} onChange={(value) => updateParams({ bonificacion: value })} label="Bonificacion" options={[{ value: "", label: "Toda bonificacion" }, { value: "CON", label: "Con bonificacion" }, { value: "SIN", label: "Sin bonificacion" }]} />
        <FilterSelect value={searchParams.get("descuentoMarca") ?? ""} onChange={(value) => updateParams({ descuentoMarca: value })} label="Marcas" options={[{ value: "", label: "Todos" }, { value: "CON", label: "Con descuento por marca" }, { value: "SIN", label: "Sin descuento por marca" }]} />
        <FilterSelect value={searchParams.get("estado") ?? "ACTIVO"} onChange={(value) => updateParams({ estado: value })} label="Estado" options={[{ value: "ACTIVO", label: "Activos" }, { value: "INACTIVO", label: "Inactivos" }, { value: "", label: "Todos" }]} />
      </section>

      <section className="overflow-x-auto border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="min-w-[1160px]">
          <div className="grid grid-cols-[minmax(230px,1.4fr)_160px_180px_150px_120px_120px_112px] border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:border-slate-800 dark:bg-slate-900">
            <span className="px-4 py-3">Cliente</span><span className="px-4 py-3">Documento</span><span className="px-4 py-3">Fiscal</span><span className="px-4 py-3">Lista</span><span className="px-4 py-3 text-right">Bonificacion</span><span className="px-4 py-3 text-center">Reglas</span><span className="px-4 py-3 text-center">Acciones</span>
          </div>
          {clientes.length === 0 ? <p className="px-4 py-16 text-center text-sm font-semibold text-slate-500">No hay clientes que coincidan con los filtros.</p> : clientes.map((cliente) => (
            <div key={cliente.id} className="grid grid-cols-[minmax(230px,1.4fr)_160px_180px_150px_120px_120px_112px] items-center border-b border-slate-100 text-xs last:border-0 dark:border-slate-800">
              <div className="min-w-0 px-4 py-3"><p className="truncate font-black text-slate-800 dark:text-white">{cliente.razon_social}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">{cliente.tipo_persona === "JURIDICA" ? "Juridica" : "Fisica"}{cliente.importado_desde_gesu ? " · GESU" : ""}</p></div>
              <div className="px-4 py-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">{documentLabel(cliente)}</div>
              <div className="px-4 py-3 text-[11px] font-bold text-slate-600 dark:text-slate-300">{fiscalLabel(cliente.condicion_iva)}</div>
              <div className="px-4 py-3 font-bold text-slate-700 dark:text-slate-200">{cliente.tipo_precio ?? "Sin lista"}</div>
              <div className="px-4 py-3 text-right font-mono font-black text-slate-700 dark:text-slate-200">{cliente.bonificacion_general.toLocaleString("es-AR", { maximumFractionDigits: 2 })}%</div>
              <div className="px-4 py-3 text-center"><span className={cliente.reglas_descuento.length ? "rounded bg-emerald-500/10 px-2 py-1 text-[10px] font-black text-emerald-700 dark:text-emerald-300" : "text-[10px] font-bold text-slate-400"}>{cliente.reglas_descuento.length ? `${cliente.reglas_descuento.length} regla${cliente.reglas_descuento.length === 1 ? "" : "s"}` : "-"}</span></div>
              <div className="flex items-center justify-center gap-1 px-4 py-3">
                {canManage ? <button type="button" title="Editar cliente" onClick={() => setEditing(cliente)} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/40"><HiPencil className="h-4 w-4" /></button> : null}
                {canManage ? <button type="button" title={cliente.activo ? "Desactivar cliente" : "Activar cliente"} disabled={updatingId === cliente.id} onClick={() => void toggleActive(cliente)} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-white">{cliente.activo ? <HiEye className="h-4 w-4" /> : <HiEyeOff className="h-4 w-4" />}</button> : null}
              </div>
            </div>
          ))}
        </div>
      </section>
      <Pagination totalPages={totalPages} />
      <ClienteModal key={editing?.id ?? (creating ? "nuevo" : "cerrado")} open={creating || Boolean(editing)} cliente={editing} marcas={marcas} tiposPrecio={tiposPrecio} categorias={categorias} subcategorias={subcategorias} onClose={() => { setCreating(false); setEditing(null); }} />
    </div>
  );
}

function FilterSelect({ value, onChange, label, options }: { value: string; onChange: (value: string) => void; label: string; options: Array<{ value: string; label: string }> }) {
  return <label className="space-y-1"><span className="block text-[9px] font-black uppercase tracking-widest text-slate-500">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function ClienteModal({ open, cliente, marcas, tiposPrecio, categorias, subcategorias, onClose }: { open: boolean; cliente: Cliente | null; marcas: CatalogoItem[]; tiposPrecio: TipoPrecio[]; categorias: CatalogoItem[]; subcategorias: Subcategoria[]; onClose: () => void }) {
  const router = useRouter();
  const formId = useId();
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<ClienteInput>(cliente ? inputFromCliente(cliente) : emptyCliente());
  const [tab, setTab] = useState<"general" | "comercial">("general");
  const [errors, setErrors] = useState<Partial<Record<keyof ClienteInput, string>>>({});
  const [saveError, setSaveError] = useState("");
  const [hasRuleDraft, setHasRuleDraft] = useState(false);
  const editing = Boolean(cliente);
  const rules = (data.reglas_descuento ?? []) as ReglaDescuentoCliente[];
  const updateRuleDraft = useCallback((pending: boolean) => {
    setHasRuleDraft(pending);
    setSaveError("");
  }, []);

  const setField = (field: keyof ClienteInput, value: unknown) => {
    setData((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
    setSaveError("");
  };
  const fieldErrorId = (field: keyof ClienteInput) => `${formId}-${field}-error`;
  const validationProps = (field: keyof ClienteInput) => ({
    "aria-invalid": Boolean(errors[field]),
    "aria-describedby": errors[field] ? fieldErrorId(field) : undefined,
  });
  const textField = (field: keyof ClienteInput, label: string, className = "", type = "text") => (
    <Field label={label} className={className} error={errors[field]} errorId={fieldErrorId(field)}>
      <input type={type} value={String(data[field] ?? "")} onChange={(event) => setField(field, event.target.value)} className="form-input" {...validationProps(field)} />
    </Field>
  );
  const changeTab = (next: typeof tab, focus = false) => {
    setTab(next);
    if (focus) document.getElementById(`${formId}-tab-${next}`)?.focus();
  };

  const submit = async () => {
    if (saving) return;
    const nextErrors: typeof errors = {};
    if (!String(data.razon_social ?? "").trim()) nextErrors.razon_social = "Ingresá el nombre o la razón social del cliente.";
    for (const field of ["email", "contacto_email"] as const) {
      const email = String(data[field] ?? "").trim();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) nextErrors[field] = "Ingresá un email válido, por ejemplo nombre@empresa.test.";
    }
    const general = Number(data.bonificacion_general ?? 0);
    if (!Number.isFinite(general) || general < 0 || general > 100) nextErrors.bonificacion_general = "La bonificación general debe estar entre 0 y 100%.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      changeTab(nextErrors.razon_social || nextErrors.email || nextErrors.contacto_email ? "general" : "comercial", true);
      setSaveError("Revisá los campos indicados antes de guardar el cliente.");
      return;
    }
    if (hasRuleDraft) {
      changeTab("comercial", true);
      setSaveError("Hay una regla sin confirmar. Usá Agregar o Aceptar cambios, o descartá el borrador antes de guardar el cliente.");
      return;
    }
    try {
      setSaveError("");
      setSaving(true);
      const response = await fetch(editing ? `/api/clientes/${cliente?.id}` : "/api/clientes", { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "No se pudo guardar el cliente.");
      toast.success(editing ? "Cliente actualizado." : "Cliente creado."); onClose(); router.refresh();
    } catch (error) {
      setSaveError(error instanceof TypeError ? "No se pudo conectar con el servidor. Revisá tu conexión e intentá guardar nuevamente." : error instanceof Error ? error.message : "No se pudo guardar el cliente. Intentá nuevamente.");
    }
    finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={() => { if (!saving) onClose(); }} title={editing ? "Editar cliente" : "Nuevo cliente"} width="w-[min(96vw,1100px)]">
      <form noValidate onSubmit={(event) => { event.preventDefault(); void submit(); }} aria-busy={saving}>
        <div role="tablist" aria-label="Secciones del cliente" className="sticky top-0 z-10 grid grid-cols-[1fr_1.4fr] gap-1 border-b border-slate-200 bg-white px-3 pt-2 dark:border-slate-800 dark:bg-slate-950 sm:flex sm:px-5">
          {([{ id: "general", label: "Datos generales" }, { id: "comercial", label: "Descuentos y bonificaciones" }] as const).map((item) => (
            <button key={item.id} id={`${formId}-tab-${item.id}`} type="button" role="tab" aria-selected={tab === item.id} aria-controls={`${formId}-panel-${item.id}`} tabIndex={tab === item.id ? 0 : -1} onClick={() => changeTab(item.id)} onKeyDown={(event) => {
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
              event.preventDefault();
              changeTab(event.key === "Home" ? "general" : event.key === "End" ? "comercial" : tab === "general" ? "comercial" : "general", true);
            }} className={`min-w-0 border-b-2 px-2 py-3 text-xs font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 sm:px-4 ${tab === item.id ? "border-blue-600 text-blue-700 dark:text-blue-300" : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800 dark:hover:text-white"}`}>
              {item.label}
            </button>
          ))}
        </div>
        <fieldset disabled={saving} className="min-w-0">
          <div id={`${formId}-panel-general`} role="tabpanel" aria-labelledby={`${formId}-tab-general`} hidden={tab !== "general"} tabIndex={0} className="space-y-5 p-4 sm:p-5">
            <p className="text-xs text-slate-500 dark:text-slate-400">Identificación, datos fiscales y medios de contacto del cliente.</p>
            <FormSection title="Identificación y datos fiscales">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {textField("razon_social", "Nombre o razón social *", "col-span-2")}
                <Field label="Persona"><select value={String(data.tipo_persona ?? "FISICA")} onChange={(event) => setField("tipo_persona", event.target.value)} className="form-input"><option value="FISICA">Física</option><option value="JURIDICA">Jurídica</option></select></Field>
                <Field label="Estado"><select value={data.activo === false ? "false" : "true"} onChange={(event) => setField("activo", event.target.value === "true")} className="form-input"><option value="true">Activo</option><option value="false">Inactivo</option></select></Field>
                <Field label="Tipo de documento"><select value={String(data.tipo_documento ?? "")} onChange={(event) => setField("tipo_documento", event.target.value)} className="form-input"><option value="">Sin definir</option><option>DNI</option><option>CUIT</option><option>CUIL</option><option>OTRO</option></select></Field>
                {textField("documento", "Número de documento")}
                <Field label="Condición IVA"><select value={String(data.condicion_iva ?? "")} onChange={(event) => setField("condicion_iva", event.target.value)} className="form-input">{IVA_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
                <Field label="Comprobante"><select value={String(data.comprobante_default ?? "")} onChange={(event) => setField("comprobante_default", event.target.value)} className="form-input">{COMPROBANTE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
              </div>
            </FormSection>
            <FormSection title="Contacto">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {textField("telefono", "Teléfono", "", "tel")}
                {textField("celular", "Celular", "", "tel")}
                {textField("email", "Email", "col-span-2", "email")}
              </div>
            </FormSection>
            <FormSection title="Domicilio">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {textField("domicilio", "Dirección", "col-span-2 lg:col-span-1")}
                {textField("localidad", "Localidad")}
                {textField("provincia", "Provincia")}
                {textField("codigo_postal", "Código postal")}
              </div>
            </FormSection>
            <FormSection title="Contacto adicional">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {textField("contacto_nombre", "Nombre del contacto")}
                {textField("contacto_telefono", "Teléfono del contacto", "", "tel")}
                {textField("contacto_celular", "Celular del contacto", "", "tel")}
                {textField("contacto_email", "Email del contacto", "col-span-2 lg:col-span-1", "email")}
              </div>
            </FormSection>
          </div>
          <div id={`${formId}-panel-comercial`} role="tabpanel" aria-labelledby={`${formId}-tab-comercial`} hidden={tab !== "comercial"} tabIndex={0} className="space-y-5 p-4 sm:p-5">
            <p className="text-xs text-slate-500 dark:text-slate-400">Administrá la lista de precios, la bonificación general y las reglas especiales de este cliente.</p>
            <FormSection title="Condiciones comerciales">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Lista de precios"><select value={String(data.id_tipo_precio ?? "")} onChange={(event) => setField("id_tipo_precio", event.target.value)} className="form-input"><option value="">MOSTRADOR (predeterminada)</option>{tiposPrecio.filter((tipo) => !["PRECIO COSTO", "MERCADO LIBRE", "MERCADOLIBRE"].includes(tipo.descripcion.trim().toUpperCase())).map((tipo) => <option key={tipo.id} value={tipo.id}>{tipo.descripcion}</option>)}</select></Field>
                <Field label="Bonificación general (%)" error={errors.bonificacion_general} errorId={fieldErrorId("bonificacion_general")}><input inputMode="decimal" value={String(data.bonificacion_general ?? 0)} onChange={(event) => setField("bonificacion_general", event.target.value.replace(",", "."))} className="form-input" {...validationProps("bonificacion_general")} /></Field>
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">La bonificación general se aplica cuando no hay una regla especial que coincida.</p>
            </FormSection>
            <ClienteDiscountRules value={rules} onChange={(next) => setField("reglas_descuento", next)} onDraftChange={updateRuleDraft} marcas={marcas} categorias={categorias} subcategorias={subcategorias} general={Number(data.bonificacion_general ?? 0)} />
          </div>
        </fieldset>
        <div className="sticky bottom-0 z-10 space-y-3 border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950 sm:px-5">
          {saveError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{saveError}</p>}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Guardar aplica los cambios de ambas pestañas.</p>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} disabled={saving} className="h-9 rounded-lg border border-slate-300 px-3 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900">Cancelar</button>
              <button type="submit" disabled={saving} className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-50"><HiSave className="h-4 w-4" />{saving ? "Guardando…" : "Guardar cliente"}</button>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function FormSection({ title, children }: { title: string; children: ReactNode }) { return <section><h3 className="mb-3 text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">{title}</h3>{children}</section>; }
function Field({ label, children, className = "", error, errorId }: { label: string; children: ReactNode; className?: string; error?: string; errorId?: string }) { return <label className={`block min-w-0 space-y-1 ${className}`}><span className="block text-[10px] font-bold text-slate-500 dark:text-slate-400">{label}</span>{children}{error && <span id={errorId} className="block text-xs text-red-600 dark:text-red-400">{error}</span>}</label>; }
