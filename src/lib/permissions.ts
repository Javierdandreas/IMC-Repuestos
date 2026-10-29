export type AppRole = string | null | undefined;
export type NormalizedAppRole = "admin" | "empleado" | "";
export type PermisoAccion = "leer" | "escribir" | "eliminar" | "exportar" | "masivo";
export type RequisitoPermiso = readonly string[];

const ACCIONES_POR_METODO: Record<string, PermisoAccion> = {
  GET: "leer",
  HEAD: "leer",
  OPTIONS: "leer",
  DELETE: "eliminar",
};

function clavePermiso(apartado: string, accion: PermisoAccion): string {
  return `${apartado}:${accion}`;
}

function requisito(apartado: string, accion: PermisoAccion): RequisitoPermiso {
  return [clavePermiso(apartado, accion)];
}

function accionPorMetodo(method: string): PermisoAccion {
  return ACCIONES_POR_METODO[method.toUpperCase()] || "escribir";
}

export function normalizeRole(role: AppRole): NormalizedAppRole {
  const normalized = String(role ?? "").trim().toLowerCase();

  if (normalized === "admin" || normalized === "empleado") {
    return normalized;
  }

  return "";
}

export function isValidRole(role: AppRole): role is "admin" | "empleado" {
  return normalizeRole(role) !== "";
}

export function canManageContent(role: AppRole, permisos: readonly string[] | null | undefined = []): boolean {
  if (normalizeRole(role) === "admin") return true;
  return normalizeRole(role) === "empleado" && Boolean(permisos?.some((permiso) => !permiso.endsWith(":leer")));
}

export function canReadContent(role: AppRole): boolean {
  const normalized = normalizeRole(role);
  return normalized === "admin" || normalized === "empleado";
}

export function puedeAccederPermisos(role: AppRole, permisos: readonly string[] | null | undefined, requisitos: RequisitoPermiso | null): boolean {
  if (normalizeRole(role) === "admin") return true;
  if (normalizeRole(role) !== "empleado" || !requisitos?.length) return false;
  const asignados = new Set(permisos || []);
  return requisitos.some((permiso) => asignados.has(permiso));
}

export function tienePermisoDeLectura(role: AppRole, permisos: readonly string[] | null | undefined): boolean {
  if (normalizeRole(role) === "admin") return true;
  return normalizeRole(role) === "empleado" && Boolean(permisos?.some((permiso) => permiso.endsWith(":leer")));
}

export function permisoParaPagina(pathname: string, searchParams: URLSearchParams): RequisitoPermiso | null {
  if (pathname === "/sin-permisos") return null;
  if (pathname === "/") return requisito("productos", "leer");
  if (pathname.startsWith("/productos")) return requisito("productos", pathname.includes("/exportar") ? "exportar" : pathname.includes("/importar") ? "masivo" : pathname.includes("/nuevo") || pathname.includes("/edit") || pathname.includes("/duplicar") ? "escribir" : "leer");
  if (pathname.startsWith("/piezas")) return requisito("piezas", pathname.includes("/nueva") || pathname.includes("/editar") ? "escribir" : pathname.includes("/importar") ? "masivo" : "leer");
  if (pathname.startsWith("/kits")) return requisito("kits", pathname.includes("/nuevo") || pathname.includes("/editar") || pathname.includes("/duplicar") ? "escribir" : pathname.includes("/importar") ? "masivo" : "leer");
  if (pathname.startsWith("/proveedores")) return requisito("proveedores", pathname.includes("/nuevo") || pathname.includes("/editar") ? "escribir" : pathname.includes("/importar") ? "masivo" : pathname.includes("/exportar") ? "exportar" : "leer");
  if (pathname.startsWith("/operaciones/mercadolibre/compatibilidades")) return requisito("ml_compatibilidades", "leer");
  if (pathname.startsWith("/operaciones/mercadolibre")) return requisito("ml_ventas", "leer");
  if (pathname.startsWith("/operaciones")) {
    const tipo = searchParams.get("tipo");
    return requisito(tipo === "COMPRA" ? "compras" : tipo === "AJUSTE" ? "ajustes_stock" : "ventas", "leer");
  }
  if (pathname.startsWith("/listados/precios-modificados")) return requisito("costos_modificados", "leer");
  if (pathname.startsWith("/listados/movimientos-stock")) return requisito("movimientos_stock", "leer");
  if (pathname.startsWith("/ubicaciones/inventario")) return requisito("inventario_ubicacion", "leer");
  if (pathname.startsWith("/ubicaciones")) return requisito("ubicaciones", "leer");
  if (pathname.startsWith("/marcas")) return requisito("marcas", "leer");
  if (pathname.startsWith("/categorias") || pathname.startsWith("/subcategorias")) return requisito("categorias", "leer");
  if (pathname.startsWith("/configuracion/base-de-datos") || pathname.startsWith("/configuracion/datos") || pathname === "/configuracion/catalogo") return ["marcas:leer", "categorias:leer", "ubicaciones:leer"];
  if (pathname.startsWith("/configuracion/catalogo-externo")) return requisito("catalogo_externo", "leer");
  if (pathname.startsWith("/configuracion/compatibilidades")) return requisito("compatibilidades", "leer");
  if (pathname.startsWith("/configuracion/costos-precios")) return requisito("productos_precios", "leer");
  if (pathname.startsWith("/configuracion/precios")) return requisito("listas_precios", "leer");
  if (pathname.startsWith("/configuracion/enriquecimiento")) return requisito("enriquecimiento", "leer");
  if (pathname.startsWith("/configuracion/mercadolibre")) return requisito("ml_integracion", "leer");
  if (pathname.startsWith("/configuracion/multimoneda")) return requisito("multimoneda", "leer");
  if (pathname.startsWith("/importaciones")) return requisito("importaciones", "leer");
  return null;
}

export function permisoParaApi(pathname: string, method: string, searchParams: URLSearchParams): RequisitoPermiso | null {
  const accion = accionPorMetodo(method);
  const conAccion = (apartado: string, accionForzada?: PermisoAccion) => requisito(apartado, accionForzada || accion);
  const operaciones = () => conAccion(searchParams.get("tipo") === "COMPRA" ? "compras" : searchParams.get("tipo") === "AJUSTE" ? "ajustes_stock" : "ventas");

  if (pathname === "/api/asistente") return ["productos:leer", "piezas:leer", "proveedores:leer", "ventas:leer"];
  if (pathname.startsWith("/api/operaciones")) return operaciones();
  if (pathname.startsWith("/api/productos")) {
    if (pathname.includes("/series") || pathname.includes("barcode")) return conAccion("codigos_series", pathname.includes("bulk") || pathname.includes("autogenerate") ? "masivo" : undefined);
    if (pathname.includes("/ubicaciones")) return conAccion("productos_stock");
    if (pathname.includes("/export")) return conAccion("productos", "exportar");
    if (pathname.includes("/import") || pathname.includes("bulk")) return conAccion("productos", "masivo");
    return conAccion("productos");
  }
  if (pathname.startsWith("/api/items/cambio-masivo")) return conAccion("productos", "masivo");
  if (pathname.startsWith("/api/piezas")) return conAccion("piezas", pathname.includes("/import") ? "masivo" : undefined);
  if (pathname.startsWith("/api/kits")) return conAccion("kits", pathname.includes("/import") ? "masivo" : undefined);
  if (pathname.startsWith("/api/series")) return conAccion("codigos_series", pathname.includes("bulk") ? "masivo" : undefined);
  if (pathname.startsWith("/api/proveedores")) {
    if (pathname.includes("/export")) return conAccion("proveedores", "exportar");
    if (pathname.includes("/import")) return conAccion("proveedores", "masivo");
    if (pathname.includes("descuentos") || pathname.includes("moneda") || pathname.includes("reglas-costo") || pathname.includes("stock-colores")) return conAccion("proveedores_precios");
    return conAccion("proveedores");
  }
  if (pathname.startsWith("/api/catalogos/marcas")) return conAccion("marcas");
  if (pathname.startsWith("/api/catalogos/proveedores")) return conAccion("proveedores");
  if (pathname.startsWith("/api/catalogos/ubicaciones")) return conAccion("ubicaciones");
  if (pathname.startsWith("/api/marcas")) return conAccion("marcas");
  if (pathname.startsWith("/api/categorias") || pathname.startsWith("/api/subcategorias")) return conAccion("categorias");
  if (pathname.startsWith("/api/tipos-precio")) return conAccion("listas_precios");
  if (pathname.startsWith("/api/multimoneda")) return conAccion("multimoneda");
  if (pathname.startsWith("/api/ubicaciones/inventario")) return conAccion("inventario_ubicacion", pathname.includes("/export") ? "exportar" : pathname.includes("/import") ? "masivo" : undefined);
  if (pathname.startsWith("/api/listados/precios-modificados")) return conAccion("costos_modificados", pathname.includes("/export") ? "exportar" : undefined);
  if (pathname.startsWith("/api/listados/movimientos-stock")) return conAccion("movimientos_stock", pathname.includes("/export") ? "exportar" : undefined);
  if (pathname.startsWith("/api/compatibilidades")) return conAccion(pathname.includes("/publicacion") ? "ml_compatibilidades" : "compatibilidades");
  if (pathname.startsWith("/api/enriquecimiento")) return conAccion("enriquecimiento");
  if (pathname.startsWith("/api/catalogo-externo")) return conAccion("catalogo_externo", pathname.includes("/import") ? "masivo" : undefined);
  if (pathname.startsWith("/api/importaciones")) return conAccion("importaciones");
  if (pathname.startsWith("/api/catalogo/export")) return conAccion("productos", "exportar");
  if (pathname.startsWith("/api/integraciones/mercadolibre/ventas")) return conAccion("ml_ventas");
  if (pathname.startsWith("/api/integraciones/mercadolibre/preguntas")) return conAccion("ml_preguntas");
  if (pathname.startsWith("/api/integraciones/mercadolibre/mensajes") || pathname.startsWith("/api/integraciones/mercadolibre/respuestas-rapidas")) return conAccion("ml_mensajes");
  if (pathname.startsWith("/api/integraciones/mercadolibre/costos")) return conAccion("ml_costos", pathname.includes("/masivo") ? "masivo" : undefined);
  if (pathname.startsWith("/api/integraciones/mercadolibre/publicaciones")) {
    if (pathname.includes("generar-descripcion")) return conAccion("ml_descripciones");
    if (pathname.includes("copiar-compatibilidades")) return conAccion("ml_compatibilidades");
    if (pathname.includes("copiar") || pathname.includes("probar") || pathname.includes("validar") || pathname.includes("revisar") || pathname.includes("lotes")) return conAccion("ml_creacion", pathname.includes("lotes") ? "masivo" : undefined);
    return conAccion("ml_publicaciones");
  }
  if (pathname.startsWith("/api/integraciones/mercadolibre/buscar-publicacion") || pathname.startsWith("/api/integraciones/mercadolibre/candidatos-vinculo") || pathname.startsWith("/api/integraciones/mercadolibre/vinculos")) return conAccion("ml_publicaciones");
  if (pathname.startsWith("/api/integraciones/mercadolibre")) return conAccion("ml_integracion");
  if (pathname.startsWith("/api/notificaciones")) return requisito("ml_ventas", "leer");
  if (pathname.startsWith("/api/geografia") || pathname.startsWith("/api/metadata")) return ["productos:leer", "piezas:leer", "proveedores:leer", "ventas:leer"];
  return null;
}

export function isEmpleado(role: AppRole): boolean {
  return normalizeRole(role) === "empleado";
}
