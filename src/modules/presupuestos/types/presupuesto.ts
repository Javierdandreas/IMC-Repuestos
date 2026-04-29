export type EstadoPresupuesto = "pendiente" | "confirmado" | "cerrado";
export type EstadoDeposito =
  | "sin_revisar"
  | "en_preparacion"
  | "separado"
  | "con_faltante";
export type EstadoDepositoItem = "pendiente" | "separado" | "no_encontrado";
export type EstadoItem = "pendiente" | "confirmado";

export type PresupuestoEnvio = {
  id: string;
  presupuestoId: string;
  numeroEnvio: number;
  codigoEnvio: string;
  usuarioNombre: string | null;
  createdAt: string;
};

export type PresupuestoEditorSourceView =
  | "pendientes"
  | "confirmados"
  | "general"
  | null;

export type ProductoCatalogo = {
  codigo: string;
  descripcion: string;
  marca: string;
  precio: number;
  stock: number;
  ubicacion: string;
};

export type PresupuestoItem = {
  id?: string;
  codigo: string;
  descripcion: string;
  marca: string;
  cantidad: number;
  precio: number;
  stock: number;
  ubicacion: string;
  estadoDepositoItem?: EstadoDepositoItem;
  estadoItem?: EstadoItem;
  envioId?: string | null;
  codigoEnvio?: string | null; // Para mostrar ej: ENV-01
  confirmadoAt?: string | null;
};

export type PresupuestoCompleto = {
  id: string;
  codigo: string;
  fecha: string;
  cliente: string;
  telefono: string;
  referencia: string;
  marca: string;
  modelo: string;
  chasis: string;
  patente: string;
  items: PresupuestoItem[];
  observaciones: string;
  total: number;
  estado: EstadoPresupuesto;
  confirmadoAt?: string;
  estadoDeposito?: EstadoDeposito;
  vendedorNombre?: string | null;
  separadorNombre?: string | null;
};

export type PresupuestoEditorModo = "editar" | "duplicar" | "recotizar";

export type PresupuestoEditorDraft = {
  modo: PresupuestoEditorModo;
  presupuestoId: string;
  conservarCliente: boolean;
  presupuesto: PresupuestoCompleto;
  sourceView?: PresupuestoEditorSourceView;
};

export type GuardarPresupuestoPayload = {
  presupuestoId?: string | null;
  codigoOriginal?: string | null;
  cliente: string;
  telefono: string;
  referencia: string;
  marca: string;
  modelo: string;
  chasis: string;
  patente: string;
  items: PresupuestoItem[];
  observaciones: string;
  total: number;
  estado: EstadoPresupuesto;
  confirmadoAt?: string;
  estadoDeposito?: EstadoDeposito;
  vendedorNombre?: string | null;
  separadorNombre?: string | null;
};

