import type {
  PresupuestoCompleto,
  PresupuestoEditorDraft,
  ProductoCatalogo,
} from "../types/presupuesto";

export const CLIENTE_STORAGE_KEY = "imc_presupuesto_cliente_vehiculo";
export const EDITOR_DRAFT_STORAGE_KEY = "imc_presupuesto_editor";

function isBrowser() {
  return typeof window !== "undefined";
}

export function normalizarChasis(value: string) {
  return value
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 17);
}

export function isChasisValido(value: string) {
  const normalizado = normalizarChasis(value);
  return /^[A-Z0-9]{17}$/.test(normalizado);
}

export function duplicarPresupuesto(
  presupuesto: PresupuestoCompleto,
  conservarCliente: boolean
) {
  return {
    ...presupuesto,
    id: crypto.randomUUID(),
    codigo: "",
    fecha: new Date().toISOString(),
    estado: "pendiente" as const,
    confirmadoAt: undefined,
    estadoDeposito: "sin_revisar" as const,
    items: presupuesto.items.map((item) => ({
      ...item,
      id: undefined, // Es un ítem nuevo para este presupuesto
      estadoItem: "pendiente" as const, // Desbloquea el ítem para que se pueda borrar/editar
      estadoDepositoItem: "pendiente" as const,
      envioId: undefined, // Limpiamos rastros del envío original
      codigoEnvio: undefined,
      confirmadoAt: undefined,
    })),
    cliente: conservarCliente ? presupuesto.cliente : "",
    telefono: conservarCliente ? presupuesto.telefono : "",
    referencia: conservarCliente ? presupuesto.referencia : "",
    marca: conservarCliente ? presupuesto.marca : "",
    modelo: conservarCliente ? presupuesto.modelo : "",
    chasis: conservarCliente ? presupuesto.chasis : "",
    patente: conservarCliente ? presupuesto.patente : "",
  };
}

/**
 * Función pura para recotizar un presupuesto usando un catálogo de referencia.
 */
export function recotizarPresupuesto(
  presupuesto: PresupuestoCompleto,
  catalogo: ProductoCatalogo[]
) {
  const catalogoPorCodigo = new Map(
    catalogo.map((producto) => [producto.codigo.trim().toLowerCase(), producto])
  );

  const itemsActualizados = presupuesto.items.map((item) => {
    const encontrado = catalogoPorCodigo.get(item.codigo.trim().toLowerCase());

    if (!encontrado) {
      return item;
    }

    return {
      ...item,
      descripcion: encontrado.descripcion,
      marca: encontrado.marca,
      precio: encontrado.precio,
      stock: encontrado.stock,
      ubicacion: encontrado.ubicacion,
    };
  });

  const total = itemsActualizados.reduce(
    (acc, item) => acc + item.cantidad * item.precio,
    0
  );

  const actualizado: PresupuestoCompleto = {
    ...presupuesto,
    fecha: new Date().toISOString(),
    items: itemsActualizados.map((item) => ({
      ...item,
      estadoDepositoItem:
        presupuesto.estado === "pendiente"
          ? "pendiente"
          : item.estadoDepositoItem ?? "pendiente",
    })),
    total,
    estadoDeposito:
      presupuesto.estado === "pendiente"
        ? "sin_revisar"
        : presupuesto.estadoDeposito,
  };

  return actualizado;
}

export function setEditorDraft(draft: PresupuestoEditorDraft) {
  if (!isBrowser()) return;
  window.sessionStorage.setItem(EDITOR_DRAFT_STORAGE_KEY, JSON.stringify(draft));
}

export function getEditorDraft(): PresupuestoEditorDraft | null {
  if (!isBrowser()) return null;

  try {
    const raw = window.sessionStorage.getItem(EDITOR_DRAFT_STORAGE_KEY);
    if (!raw) return null;

    return JSON.parse(raw) as PresupuestoEditorDraft;
  } catch (error) {
    console.error("Error al leer el draft del editor:", error);
    return null;
  }
}

export function clearEditorDraft() {
  if (!isBrowser()) return;
  window.sessionStorage.removeItem(EDITOR_DRAFT_STORAGE_KEY);
}

export function consumeEditorDraft(): PresupuestoEditorDraft | null {
  const draft = getEditorDraft();
  if (draft) {
    clearEditorDraft();
  }
  return draft;
}

