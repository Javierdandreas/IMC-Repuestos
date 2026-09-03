"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { CatalogForm } from "@/components/ui/CatalogForm";
import { PencilButton, PencilLink } from "@/components/ui/PencilButton";
import { TrashButton } from "@/components/ui/TrashButton";
import { Pagination } from "@/components/ui/Pagination";
import { usePermissions } from "@/components/auth/usePermissions";
import { toast } from "sonner";
import { HiCloudDownload, HiCloudUpload, HiSave } from "react-icons/hi";

type CatalogItem = {
  id: number;
  descripcion: string;
  documento?: string | null;
  condicion_iva?: string | null;
  comprobante_default?: string | null;
  contacto?: string | null;
  telefono?: string | null;
  email?: string | null;
  domicilio_fiscal?: string | null;
  provincia?: string | null;
  localidad?: string | null;
  codigo_postal?: string | null;
  activo?: boolean;
  observaciones?: string | null;
};

type Props = {
  /** Lista de items a mostrar */
  items: CatalogItem[];
  /** Ruta base de la API (ej: "/api/marcas") */
  apiPath: string;
  /** Nombre singular de la entidad (ej: "marca") */
  entityName: string;
  /** Nombre plural para el título (ej: "Marcas") */
  title: string;
  /** Texto del botón de creación (ej: "Nueva marca") */
  createLabel: string;
  /** Total de paginas para la paginacion */
  totalPages?: number;
  /** Ruta base opcional para editar en pagina en vez de modal */
  editPathBase?: string;
  /** Ruta opcional para crear en una pagina en vez de modal */
  createPath?: string;
  /** Pantalla opcional para importar el catalogo */
  importPath?: string;
  /** Pantalla opcional para exportar el catalogo */
  exportPath?: string;
};

/**
 * Componente genérico para listar, crear, editar y eliminar entidades de catálogo simples.
 * Reemplaza MarcaList y ProveedorList que eran ~95% idénticos.
 */
export function CatalogList({
  items,
  apiPath,
  entityName,
  title,
  createLabel,
  totalPages = 1,
  editPathBase,
  createPath,
  importPath,
  exportPath,
}: Props) {
  const router = useRouter();
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const { canManage } = usePermissions();
  const [openNew, setOpenNew] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [triggerSave, setTriggerSave] = useState(0);
  const [deletingItem, setDeletingItem] = useState<CatalogItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const isProveedor = entityName.toLowerCase() === "proveedor";

  // Debounced search sync with URL
  useEffect(() => {
    const timer = setTimeout(() => {
      const current = new URLSearchParams(window.location.search);
      if (search) {
        current.set("search", search);
      } else {
        current.delete("search");
      }
      current.set("page", "1");
      router.push(`?${current.toString()}`);
    }, 400);
    return () => clearTimeout(timer);
  }, [search, router]);

  const handleDelete = async () => {
    if (!deletingItem) return;

    try {
      setIsDeleting(true);
      const response = await fetch(`${deletingItem.id ? `${apiPath}/${deletingItem.id}` : apiPath}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || `No se pudo borrar ${entityName}`);
      }

      setDeletingItem(null);
      toast.success(`${capitalize(entityName)} eliminada correctamente`);
      router.refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : `No se pudo borrar ${entityName}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="mx-auto w-full max-w-7xl py-8 px-4 md:px-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">{title}</h1>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Gestión de catálogos</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative group">
              <input
                type="text"
                placeholder={isProveedor ? "BUSCAR NOMBRE, CUIT O DNI..." : `BUSCAR ${entityName.toUpperCase()}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-11 w-64 rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-xs font-bold uppercase outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:focus:border-blue-500"
              />
              <svg className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400 transition group-focus-within:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {exportPath ? (
              <Link
                href={exportPath}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black uppercase tracking-widest text-slate-700 transition hover:border-blue-200 hover:text-blue-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500/50 dark:hover:text-blue-400"
              >
                <HiCloudDownload className="h-4 w-4" />
                Exportar
              </Link>
            ) : null}

            {canManage && importPath ? (
              <Link
                href={importPath}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black uppercase tracking-widest text-slate-700 transition hover:border-blue-200 hover:text-blue-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500/50 dark:hover:text-blue-400"
              >
                <HiCloudUpload className="h-4 w-4" />
                Importar
              </Link>
            ) : null}

            {canManage ? createPath ? (
              <Link
                href={createPath}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-6 text-sm font-bold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 shadow-md active:scale-95"
              >
                {createLabel}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setOpenNew(true)}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-6 text-sm font-bold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 shadow-md active:scale-95"
              >
                {createLabel}
              </button>
            ) : null}
          </div>
        </div>

        <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-slate-50/50 shadow-xl dark:border-slate-800 dark:bg-slate-900 shadow-slate-200/50 dark:shadow-none">
          <div className={isProveedor ? "min-w-[960px]" : "min-w-[500px]"}>
            <div className={`${isProveedor ? "grid-cols-[80px_minmax(240px,1fr)_150px_190px_130px_120px]" : "grid-cols-[100px_1fr_120px]"} grid bg-slate-50/50 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:bg-slate-800/80 dark:text-slate-400 dark:border-slate-800`}>
              <div className="px-5 py-4">ID</div>
              <div className="px-5 py-4">Descripción</div>
              {isProveedor && (
                <>
                  <div className="px-5 py-4">CUIT / DNI</div>
                  <div className="px-5 py-4">Condicion IVA</div>
                  <div className="px-5 py-4">Comprobante</div>
                </>
              )}
              <div className="px-5 py-4 text-center border-l border-slate-200 dark:border-slate-800/50">Acciones</div>
            </div>

            {items.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm font-medium text-slate-500 dark:text-slate-500">No hay resultados para esta búsqueda.</div>
            ) : (
              <div className="divide-y divide-slate-100 bg-white/50 dark:divide-slate-800 dark:bg-slate-900/50">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={`${isProveedor ? "grid-cols-[80px_minmax(240px,1fr)_150px_190px_130px_120px]" : "grid-cols-[100px_1fr_120px]"} grid items-center transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/30`}
                  >
                    <div className="px-5 py-4 text-sm font-mono font-bold text-slate-400 dark:text-slate-500">#{item.id}</div>
                    <div className="px-5 py-4 text-sm font-bold text-slate-800 dark:text-slate-200">{item.descripcion}</div>
                    {isProveedor && (
                      <>
                        <div className="px-5 py-4 text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
                          {formatProviderDocumento(item.documento)}
                        </div>
                        <div className="px-5 py-4 text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
                          {formatProviderFiscalValue(item.condicion_iva)}
                        </div>
                        <div className="px-5 py-4 text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
                          {formatProviderFiscalValue(item.comprobante_default)}
                        </div>
                      </>
                    )}
                    <div className="px-5 py-4 flex items-center justify-center gap-2.5 border-l border-slate-50 dark:border-slate-800/50">
                      {canManage ? (<>
                        {editPathBase ? (
                          <PencilLink
                            label={`Editar ${entityName} ${item.descripcion}`}
                            href={`${editPathBase}/${item.id}`}
                          />
                        ) : (
                          <PencilButton
                            label={`Editar ${entityName} ${item.descripcion}`}
                            onClick={() => setEditingItem(item)}
                          />
                        )}
                        <TrashButton
                          label={`Borrar ${entityName} ${item.descripcion}`}
                          onClick={() => setDeletingItem(item)}
                          disabled={isDeleting && deletingItem?.id === item.id}
                        />
                      </>) : <span className="text-[10px] font-black tracking-widest text-slate-400">READONLY</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {totalPages > 1 && (
          <div className="mt-8 flex justify-center">
            <Pagination totalPages={totalPages} />
          </div>
        )}
      </div>

      {!createPath ? (
        <Modal
          title={createLabel}
          open={canManage && openNew}
          onClose={() => setOpenNew(false)}
          width="w-[min(96vw,1400px)]"
        >
          <CatalogForm
            apiPath={apiPath}
            entityName={entityName}
            onSuccess={() => {
              setOpenNew(false);
              router.refresh();
            }}
            onCancel={() => setOpenNew(false)}
          />
        </Modal>
      ) : null}

      <Modal
        title={`Editar ${entityName}`}
        open={canManage && !!editingItem}
        onClose={() => {
          setEditingItem(null);
          setTriggerSave(0);
        }}
        headerActions={
          entityName.toLowerCase() === "proveedor" && (
            <button
              onClick={() => setTriggerSave(v => v + 1)}
              className="h-10 px-6 flex items-center gap-2.5 rounded-xl bg-blue-600 text-white font-black uppercase tracking-widest text-[10px] transition hover:bg-blue-700 shadow-lg shadow-blue-500/20 active:scale-95"
            >
              <HiSave className="h-4 w-4" />
              GUARDAR
            </button>
          )
        }
        width="w-[min(96vw,1400px)]"
      >
        <CatalogForm
          apiPath={apiPath}
          entityName={entityName}
          entityId={editingItem?.id}
          initialDescripcion={editingItem?.descripcion ?? ""}
          initialDocumento={editingItem?.documento}
          initialCondicionIva={editingItem?.condicion_iva}
          initialComprobanteDefault={editingItem?.comprobante_default}
          initialContacto={editingItem?.contacto}
          initialTelefono={editingItem?.telefono}
          initialEmail={editingItem?.email}
          initialDomicilioFiscal={editingItem?.domicilio_fiscal}
          initialProvincia={editingItem?.provincia}
          initialLocalidad={editingItem?.localidad}
          initialCodigoPostal={editingItem?.codigo_postal}
          initialActivo={editingItem?.activo}
          initialObservaciones={editingItem?.observaciones}
          triggerSave={triggerSave}
          onSuccess={() => {
            setEditingItem(null);
            setTriggerSave(0);
            router.refresh();
          }}
          onCancel={() => {
            setEditingItem(null);
            setTriggerSave(0);
          }}
        />
      </Modal>

      <ConfirmDeleteModal
        open={canManage && !!deletingItem}
        title={`Borrar ${entityName}`}
        description={
          deletingItem
            ? `¿Seguro que querés borrar ${entityName} "${deletingItem.descripcion}"? Esta acción no se puede deshacer.`
            : ""
        }
        loading={isDeleting}
        onConfirm={handleDelete}
        onClose={() => setDeletingItem(null)}
      />
    </>
  );
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatProviderFiscalValue(value?: string | null): string {
  if (!value) return "-";
  return value.replace(/_/g, " ");
}

function formatProviderDocumento(value?: string | null): string {
  if (!value) return "-";
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11) return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
  return digits || value;
}
