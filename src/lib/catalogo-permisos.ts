export const ACCIONES_PERMISO = ["leer", "escribir", "eliminar", "exportar", "masivo"] as const;
export type AccionPermiso = typeof ACCIONES_PERMISO[number];

type Apartado = {
  id: string;
  grupo: string;
  nombre: string;
  acciones: readonly AccionPermiso[];
};

const lecturaEscritura = ["leer", "escribir"] as const;
const gestion = ["leer", "escribir", "eliminar", "exportar", "masivo"] as const;

// Este catalogo no concede permisos: las acciones deben comprobarse en el servidor.
export const CATALOGO_PERMISOS: readonly Apartado[] = [
  { id: "ventas", grupo: "Operaciones", nombre: "Ventas", acciones: lecturaEscritura },
  { id: "compras", grupo: "Operaciones", nombre: "Compras", acciones: lecturaEscritura },
  { id: "ajustes_stock", grupo: "Operaciones", nombre: "Ajustes de stock", acciones: lecturaEscritura },
  { id: "series_movimientos", grupo: "Operaciones", nombre: "Movimientos y series", acciones: lecturaEscritura },
  { id: "ml_ventas", grupo: "Mercado Libre", nombre: "Ventas", acciones: lecturaEscritura },
  { id: "ml_preguntas", grupo: "Mercado Libre", nombre: "Preguntas y respuestas", acciones: lecturaEscritura },
  { id: "ml_mensajes", grupo: "Mercado Libre", nombre: "Mensajes automaticos", acciones: lecturaEscritura },
  { id: "ml_publicaciones", grupo: "Mercado Libre", nombre: "Publicaciones y vinculos", acciones: lecturaEscritura },
  { id: "ml_creacion", grupo: "Mercado Libre", nombre: "Crear y duplicar publicaciones", acciones: ["leer", "escribir", "masivo"] },
  { id: "ml_compatibilidades", grupo: "Mercado Libre", nombre: "Compatibilidades de publicaciones", acciones: lecturaEscritura },
  { id: "ml_descripciones", grupo: "Mercado Libre", nombre: "Descripciones con ChatGPT", acciones: lecturaEscritura },
  { id: "ml_costos", grupo: "Mercado Libre", nombre: "Costos", acciones: ["leer", "escribir", "masivo"] },
  { id: "ml_integracion", grupo: "Mercado Libre", nombre: "Conexion y configuracion", acciones: lecturaEscritura },
  { id: "productos", grupo: "Items y catalogo", nombre: "Items y productos", acciones: gestion },
  { id: "productos_precios", grupo: "Items y catalogo", nombre: "Precios y costos", acciones: ["leer", "escribir", "exportar", "masivo"] },
  { id: "productos_stock", grupo: "Items y catalogo", nombre: "Stock", acciones: ["leer", "escribir", "exportar", "masivo"] },
  { id: "piezas", grupo: "Items y catalogo", nombre: "Items asociados y piezas", acciones: gestion },
  { id: "kits", grupo: "Items y catalogo", nombre: "Kits", acciones: gestion },
  { id: "codigos_series", grupo: "Items y catalogo", nombre: "Codigos de barras y series", acciones: ["leer", "escribir", "masivo"] },
  { id: "proveedores", grupo: "Contactos y listados", nombre: "Proveedores", acciones: gestion },
  { id: "proveedores_precios", grupo: "Contactos y listados", nombre: "Precios y reglas de proveedores", acciones: ["leer", "escribir", "exportar", "masivo"] },
  { id: "costos_modificados", grupo: "Contactos y listados", nombre: "Costos modificados", acciones: ["leer", "escribir", "exportar"] },
  { id: "movimientos_stock", grupo: "Contactos y listados", nombre: "Movimientos de stock", acciones: ["leer", "exportar"] },
  { id: "inventario_ubicacion", grupo: "Contactos y listados", nombre: "Inventario por ubicacion", acciones: ["leer", "escribir", "exportar", "masivo"] },
  { id: "marcas", grupo: "Configuracion", nombre: "Marcas", acciones: ["leer", "escribir", "eliminar"] },
  { id: "categorias", grupo: "Configuracion", nombre: "Categorias y subcategorias", acciones: ["leer", "escribir", "eliminar"] },
  { id: "ubicaciones", grupo: "Configuracion", nombre: "Ubicaciones", acciones: ["leer", "escribir", "eliminar"] },
  { id: "listas_precios", grupo: "Configuracion", nombre: "Listas y tipos de precio", acciones: ["leer", "escribir", "eliminar"] },
  { id: "multimoneda", grupo: "Configuracion", nombre: "Multimoneda", acciones: lecturaEscritura },
  { id: "compatibilidades", grupo: "Configuracion", nombre: "Compatibilidades del catalogo", acciones: ["leer", "escribir", "eliminar", "exportar"] },
  { id: "enriquecimiento", grupo: "Configuracion", nombre: "Enriquecimiento", acciones: lecturaEscritura },
  { id: "catalogo_externo", grupo: "Configuracion", nombre: "Catalogo externo", acciones: ["leer", "escribir", "masivo"] },
  { id: "importaciones", grupo: "Configuracion", nombre: "Importaciones", acciones: ["leer", "escribir", "exportar", "masivo"] },
  { id: "usuarios", grupo: "Configuracion", nombre: "Usuarios y permisos", acciones: lecturaEscritura },
];

export function permisoValido(apartado: string, accion: string): boolean {
  const encontrado = CATALOGO_PERMISOS.find((entry) => entry.id === apartado);
  return Boolean(encontrado?.acciones.some((a) => a === accion));
}

export function asignacionesValidas(permisos: Array<{ apartado: string; accion: string }>): boolean {
  const keys = new Set(permisos.map((p) => `${p.apartado}:${p.accion}`));
  return keys.size === permisos.length && permisos.every((p) => permisoValido(p.apartado, p.accion) && (p.accion === "leer" || keys.has(`${p.apartado}:leer`)));
}
