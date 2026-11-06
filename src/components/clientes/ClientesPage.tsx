"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HiEye, HiEyeOff, HiPencil, HiPlus, HiSave, HiSearch, HiTrash } from "react-icons/hi";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { usePermissions } from "@/components/auth/usePermissions";
import { useAppError } from "@/context/AppErrorContext";
import type { CatalogoItem, TipoPrecio } from "@/interfaces/productos";
import type { Cliente, ClienteInput } from "@/lib/repos/clientes";

type Props = {
  clientes: Cliente[];
  totalPages: number;
  totalCount: number;
  marcas: CatalogoItem[];
  tiposPrecio: TipoPrecio[];
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
  };
}

export function ClientesPage({ clientes, totalPages, totalCount, marcas, tiposPrecio }: Props) {
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
        <label className="relative">
          <HiSearch className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input defaultValue={searchParams.get("q") ?? ""} onChange={(event) => updateParams({ q: event.target.value.trim() })} placeholder="Buscar nombre, documento o contacto" className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs font-bold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
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
            <span className="px-4 py-3">Cliente</span><span className="px-4 py-3">Documento</span><span className="px-4 py-3">Fiscal</span><span className="px-4 py-3">Lista</span><span className="px-4 py-3 text-right">Bonificacion</span><span className="px-4 py-3 text-center">Marca</span><span className="px-4 py-3 text-center">Acciones</span>
          </div>
          {clientes.length === 0 ? <p className="px-4 py-16 text-center text-sm font-semibold text-slate-500">No hay clientes que coincidan con los filtros.</p> : clientes.map((cliente) => (
            <div key={cliente.id} className="grid grid-cols-[minmax(230px,1.4fr)_160px_180px_150px_120px_120px_112px] items-center border-b border-slate-100 text-xs last:border-0 dark:border-slate-800">
              <div className="min-w-0 px-4 py-3"><p className="truncate font-black text-slate-800 dark:text-white">{cliente.razon_social}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">{cliente.tipo_persona === "JURIDICA" ? "Juridica" : "Fisica"}{cliente.importado_desde_gesu ? " · GESU" : ""}</p></div>
              <div className="px-4 py-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">{documentLabel(cliente)}</div>
              <div className="px-4 py-3 text-[11px] font-bold text-slate-600 dark:text-slate-300">{fiscalLabel(cliente.condicion_iva)}</div>
              <div className="px-4 py-3 font-bold text-slate-700 dark:text-slate-200">{cliente.tipo_precio ?? "Sin lista"}</div>
              <div className="px-4 py-3 text-right font-mono font-black text-slate-700 dark:text-slate-200">{cliente.bonificacion_general.toLocaleString("es-AR", { maximumFractionDigits: 2 })}%</div>
              <div className="px-4 py-3 text-center"><span className={cliente.descuentos_marca.length ? "rounded bg-emerald-500/10 px-2 py-1 text-[10px] font-black text-emerald-700 dark:text-emerald-300" : "text-[10px] font-bold text-slate-400"}>{cliente.descuentos_marca.length ? `${cliente.descuentos_marca.length} regla${cliente.descuentos_marca.length === 1 ? "" : "s"}` : "-"}</span></div>
              <div className="flex items-center justify-center gap-1 px-4 py-3">
                {canManage ? <button type="button" title="Editar cliente" onClick={() => setEditing(cliente)} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/40"><HiPencil className="h-4 w-4" /></button> : null}
                {canManage ? <button type="button" title={cliente.activo ? "Desactivar cliente" : "Activar cliente"} disabled={updatingId === cliente.id} onClick={() => void toggleActive(cliente)} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-white">{cliente.activo ? <HiEye className="h-4 w-4" /> : <HiEyeOff className="h-4 w-4" />}</button> : null}
              </div>
            </div>
          ))}
        </div>
      </section>
      <Pagination totalPages={totalPages} />
      <ClienteModal open={creating || Boolean(editing)} cliente={editing} marcas={marcas} tiposPrecio={tiposPrecio} onClose={() => { setCreating(false); setEditing(null); }} />
    </div>
  );
}

function FilterSelect({ value, onChange, label, options }: { value: string; onChange: (value: string) => void; label: string; options: Array<{ value: string; label: string }> }) {
  return <label className="space-y-1"><span className="block text-[9px] font-black uppercase tracking-widest text-slate-500">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function ClienteModal({ open, cliente, marcas, tiposPrecio, onClose }: { open: boolean; cliente: Cliente | null; marcas: CatalogoItem[]; tiposPrecio: TipoPrecio[]; onClose: () => void }) {
  const router = useRouter();
  const { showMessage } = useAppError();
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<ClienteInput>(cliente ? inputFromCliente(cliente) : emptyCliente());
  const [marcaId, setMarcaId] = useState("");
  const [marcaDescuento, setMarcaDescuento] = useState("");
  const editing = Boolean(cliente);
  const selectedBrands = Array.isArray(data.descuentos_marca) ? data.descuentos_marca as Array<{ id_marca: number; descuento: number }> : [];
  const availableBrands = marcas.filter((marca) => !selectedBrands.some((rule) => rule.id_marca === marca.id));

  useEffect(() => {
    if (!open) return;
    setData(cliente ? inputFromCliente(cliente) : emptyCliente());
    setMarcaId("");
    setMarcaDescuento("");
  }, [cliente, open]);

  const setField = (field: keyof ClienteInput, value: unknown) => setData((previous) => ({ ...previous, [field]: value }));
  const addBrand = () => {
    const id = Number(marcaId); const descuento = Number(marcaDescuento);
    if (!Number.isInteger(id) || id <= 0 || !Number.isFinite(descuento) || descuento < 0 || descuento > 100) return;
    setField("descuentos_marca", [...selectedBrands, { id_marca: id, descuento }]); setMarcaId(""); setMarcaDescuento("");
  };
  const removeBrand = (id: number) => setField("descuentos_marca", selectedBrands.filter((rule) => rule.id_marca !== id));
  const submit = async () => {
    try {
      setSaving(true);
      const response = await fetch(editing ? `/api/clientes/${cliente?.id}` : "/api/clientes", { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "No se pudo guardar el cliente.");
      toast.success(editing ? "Cliente actualizado." : "Cliente creado."); onClose(); router.refresh();
    } catch (error) { showMessage(error instanceof Error ? error.message : "No se pudo guardar el cliente.", "Clientes"); }
    finally { setSaving(false); }
  };

  return <Modal open={open} onClose={onClose} title={editing ? "Editar cliente" : "Nuevo cliente"} width="w-[min(96vw,1100px)]" headerActions={<button type="button" onClick={() => void submit()} disabled={saving} className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-3 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-50"><HiSave className="h-4 w-4" />{saving ? "Guardando" : "Guardar"}</button>}><div className="space-y-6 p-5">
    <FormSection title="Datos fiscales"><div className="grid gap-3 md:grid-cols-4"><Field label="Nombre o razon social" className="md:col-span-2"><input value={String(data.razon_social ?? "")} onChange={(event) => setField("razon_social", event.target.value)} className="form-input" /></Field><Field label="Persona"><select value={String(data.tipo_persona ?? "FISICA")} onChange={(event) => setField("tipo_persona", event.target.value)} className="form-input"><option value="FISICA">Fisica</option><option value="JURIDICA">Juridica</option></select></Field><Field label="Estado"><select value={data.activo === false ? "false" : "true"} onChange={(event) => setField("activo", event.target.value === "true")} className="form-input"><option value="true">Activo</option><option value="false">Inactivo</option></select></Field><Field label="Tipo documento"><select value={String(data.tipo_documento ?? "")} onChange={(event) => setField("tipo_documento", event.target.value)} className="form-input"><option value="">Sin definir</option><option>DNI</option><option>CUIT</option><option>CUIL</option><option>OTRO</option></select></Field><Field label="Numero documento"><input value={String(data.documento ?? "")} onChange={(event) => setField("documento", event.target.value)} className="form-input" /></Field><Field label="Condicion IVA"><select value={String(data.condicion_iva ?? "")} onChange={(event) => setField("condicion_iva", event.target.value)} className="form-input">{IVA_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field><Field label="Comprobante"><select value={String(data.comprobante_default ?? "")} onChange={(event) => setField("comprobante_default", event.target.value)} className="form-input">{COMPROBANTE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field></div></FormSection>
    <FormSection title="Contacto y domicilio"><div className="grid gap-3 md:grid-cols-4"><Field label="Telefono"><input value={String(data.telefono ?? "")} onChange={(event) => setField("telefono", event.target.value)} className="form-input" /></Field><Field label="Celular"><input value={String(data.celular ?? "")} onChange={(event) => setField("celular", event.target.value)} className="form-input" /></Field><Field label="Email" className="md:col-span-2"><input type="email" value={String(data.email ?? "")} onChange={(event) => setField("email", event.target.value)} className="form-input" /></Field><Field label="Domicilio" className="md:col-span-2"><input value={String(data.domicilio ?? "")} onChange={(event) => setField("domicilio", event.target.value)} className="form-input" /></Field><Field label="Localidad"><input value={String(data.localidad ?? "")} onChange={(event) => setField("localidad", event.target.value)} className="form-input" /></Field><Field label="Provincia"><input value={String(data.provincia ?? "")} onChange={(event) => setField("provincia", event.target.value)} className="form-input" /></Field><Field label="Codigo postal"><input value={String(data.codigo_postal ?? "")} onChange={(event) => setField("codigo_postal", event.target.value)} className="form-input" /></Field></div><div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-800"><p className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Contacto adicional</p><div className="grid gap-3 md:grid-cols-4"><Field label="Nombre"><input value={String(data.contacto_nombre ?? "")} onChange={(event) => setField("contacto_nombre", event.target.value)} className="form-input" /></Field><Field label="Telefono"><input value={String(data.contacto_telefono ?? "")} onChange={(event) => setField("contacto_telefono", event.target.value)} className="form-input" /></Field><Field label="Celular"><input value={String(data.contacto_celular ?? "")} onChange={(event) => setField("contacto_celular", event.target.value)} className="form-input" /></Field><Field label="Email"><input type="email" value={String(data.contacto_email ?? "")} onChange={(event) => setField("contacto_email", event.target.value)} className="form-input" /></Field></div></div></FormSection>
    <FormSection title="Condiciones comerciales"><div className="grid gap-3 md:grid-cols-3"><Field label="Lista de precios"><select value={String(data.id_tipo_precio ?? "")} onChange={(event) => setField("id_tipo_precio", event.target.value)} className="form-input"><option value="">Sin lista asignada</option>{tiposPrecio.map((tipo) => <option key={tipo.id} value={tipo.id}>{tipo.descripcion}</option>)}</select></Field><Field label="Bonificacion general (%)"><input type="number" min="0" max="100" step="0.01" value={String(data.bonificacion_general ?? 0)} onChange={(event) => setField("bonificacion_general", event.target.value)} className="form-input" /></Field></div><div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-800"><div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_130px_auto]"><Field label="Descuento por marca"><select value={marcaId} onChange={(event) => setMarcaId(event.target.value)} className="form-input"><option value="">Seleccionar marca</option>{availableBrands.map((marca) => <option key={marca.id} value={marca.id}>{marca.descripcion}</option>)}</select></Field><Field label="Descuento %"><input type="number" min="0" max="100" step="0.01" value={marcaDescuento} onChange={(event) => setMarcaDescuento(event.target.value)} className="form-input" /></Field><button type="button" onClick={addBrand} className="mt-[21px] inline-flex h-10 items-center justify-center gap-1 rounded-lg border border-blue-600 px-3 text-[10px] font-black uppercase tracking-widest text-blue-600 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950/40"><HiPlus className="h-4 w-4" />Agregar</button></div><div className="mt-3 space-y-2">{selectedBrands.length === 0 ? <p className="text-xs text-slate-500">Sin descuentos por marca.</p> : selectedBrands.map((rule) => { const marca = marcas.find((item) => item.id === rule.id_marca); return <div key={rule.id_marca} className="flex items-center justify-between border border-slate-200 px-3 py-2 text-xs dark:border-slate-800"><span className="font-bold text-slate-700 dark:text-slate-200">{marca?.descripcion ?? "Marca eliminada"}</span><span className="flex items-center gap-3"><b>{Number(rule.descuento).toLocaleString("es-AR", { maximumFractionDigits: 2 })}%</b><button type="button" onClick={() => removeBrand(rule.id_marca)} title="Quitar descuento por marca" className="text-red-500 hover:text-red-600"><HiTrash className="h-4 w-4" /></button></span></div>; })}</div></div></FormSection>
  </div></Modal>;
}

function FormSection({ title, children }: { title: string; children: ReactNode }) { return <section><h3 className="mb-3 text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">{title}</h3>{children}</section>; }
function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) { return <label className={`block space-y-1 ${className}`}><span className="block text-[9px] font-black uppercase tracking-widest text-slate-500">{label}</span>{children}</label>; }
