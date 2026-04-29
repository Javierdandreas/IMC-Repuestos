import type {
  AuthenticatedInternalUser,
  CanonicalRole,
  CanonicalRoleOrEmpty,
} from "../types/auth.types";

const CANONICAL_ROLES = [
  "admin",
  "supervisor",
  "catalogo",
  "vendedor",
  "deposito",
  "empleado",
] as const satisfies ReadonlyArray<CanonicalRole>;

export const ALL_PERMISSIONS = [
  "productos.ver",
  "productos.crear",
  "productos.editar",
  "productos.eliminar",
  "productos.exportar",
  "piezas.ver",
  "piezas.crear",
  "piezas.editar",
  "piezas.eliminar",
  "proveedores.ver",
  "proveedores.crear",
  "proveedores.editar",
  "proveedores.eliminar",
  "proveedores.importar",
  "presupuestos.ver",
  "presupuestos.crear",
  "presupuestos.editar",
  "presupuestos.confirmar",
  "presupuestos.preparar",
  "presupuestos.entregar",
  "presupuestos.eliminar",
  "clientes.ver",
  "clientes.crear",
  "clientes.editar",
  "vehiculos.ver",
  "vehiculos.crear",
  "vehiculos.editar",
  "series.ver",
  "series.crear",
  "series.mover",
  "series.vender",
  "series.baja",
  "operaciones.ver",
  "operaciones.crear",
  "operaciones.anular",
  "sync.ver",
  "sync.ejecutar",
  "notificaciones.ver",
  "usuarios.ver",
  "usuarios.crear",
  "usuarios.editar",
  "usuarios.administrar",
  "categorias.ver",
  "categorias.crear",
  "categorias.editar",
  "categorias.eliminar",
  "subcategorias.ver",
  "subcategorias.crear",
  "subcategorias.editar",
  "subcategorias.eliminar",
  "marcas.ver",
  "marcas.crear",
  "marcas.editar",
  "marcas.eliminar",
  "ubicaciones.ver",
  "ubicaciones.crear",
  "ubicaciones.editar",
  "ubicaciones.eliminar",
  "kits.ver",
  "kits.crear",
  "kits.editar",
  "kits.eliminar",
  "importaciones.ver",
  "importaciones.crear",
  "importaciones.aplicar",
] as const;

export type AppPermission = (typeof ALL_PERMISSIONS)[number];

export type AppModule =
  | "productos"
  | "piezas"
  | "proveedores"
  | "presupuestos"
  | "clientes"
  | "vehiculos"
  | "series"
  | "operaciones"
  | "sync"
  | "usuarios"
  | "categorias"
  | "subcategorias"
  | "marcas"
  | "ubicaciones"
  | "kits"
  | "importaciones";

type PermissionTarget =
  | Pick<AuthenticatedInternalUser, "rol">
  | CanonicalRole
  | CanonicalRoleOrEmpty
  | string
  | null
  | undefined;

const VIEW_PERMISSIONS_BY_MODULE: Record<AppModule, AppPermission[]> = {
  productos: ["productos.ver"],
  piezas: ["piezas.ver"],
  proveedores: ["proveedores.ver"],
  presupuestos: ["presupuestos.ver"],
  clientes: ["clientes.ver"],
  vehiculos: ["vehiculos.ver"],
  series: ["series.ver"],
  operaciones: ["operaciones.ver"],
  sync: ["sync.ver"],
  usuarios: ["usuarios.ver"],
  categorias: ["categorias.ver"],
  subcategorias: ["subcategorias.ver"],
  marcas: ["marcas.ver"],
  ubicaciones: ["ubicaciones.ver"],
  kits: ["kits.ver"],
  importaciones: ["importaciones.ver"],
};

const CONTENT_MANAGEMENT_PERMISSIONS: AppPermission[] = [
  "productos.crear",
  "productos.editar",
  "productos.eliminar",
  "piezas.crear",
  "piezas.editar",
  "piezas.eliminar",
  "proveedores.crear",
  "proveedores.editar",
  "proveedores.eliminar",
  "proveedores.importar",
  "categorias.crear",
  "categorias.editar",
  "categorias.eliminar",
  "subcategorias.crear",
  "subcategorias.editar",
  "subcategorias.eliminar",
  "marcas.crear",
  "marcas.editar",
  "marcas.eliminar",
  "ubicaciones.crear",
  "ubicaciones.editar",
  "ubicaciones.eliminar",
  "kits.crear",
  "kits.editar",
  "kits.eliminar",
  "importaciones.crear",
  "importaciones.aplicar",
];

const UNIQUE_NON_ADMIN_PERMISSIONS = {
  supervisor: [
    "productos.ver",
    "productos.exportar",
    "piezas.ver",
    "proveedores.ver",
    "presupuestos.ver",
    "presupuestos.crear",
    "presupuestos.editar",
    "presupuestos.confirmar",
    "presupuestos.preparar",
    "presupuestos.entregar",
    "presupuestos.eliminar",
    "clientes.ver",
    "clientes.crear",
    "clientes.editar",
    "vehiculos.ver",
    "vehiculos.crear",
    "vehiculos.editar",
    "series.ver",
    "series.mover",
    "series.vender",
    "operaciones.ver",
    "notificaciones.ver",
    "categorias.ver",
    "subcategorias.ver",
    "marcas.ver",
    "ubicaciones.ver",
    "kits.ver",
    "importaciones.ver",
  ],
  catalogo: [
    "productos.ver",
    "productos.crear",
    "productos.editar",
    "productos.eliminar",
    "productos.exportar",
    "piezas.ver",
    "piezas.crear",
    "piezas.editar",
    "piezas.eliminar",
    "proveedores.ver",
    "proveedores.crear",
    "proveedores.editar",
    "proveedores.eliminar",
    "proveedores.importar",
    "presupuestos.ver",
    "series.ver",
    "categorias.ver",
    "categorias.crear",
    "categorias.editar",
    "categorias.eliminar",
    "subcategorias.ver",
    "subcategorias.crear",
    "subcategorias.editar",
    "subcategorias.eliminar",
    "marcas.ver",
    "marcas.crear",
    "marcas.editar",
    "marcas.eliminar",
    "ubicaciones.ver",
    "kits.ver",
    "kits.crear",
    "kits.editar",
    "kits.eliminar",
    "importaciones.ver",
    "importaciones.crear",
    "importaciones.aplicar",
    "notificaciones.ver",
  ],
  vendedor: [
    "productos.ver",
    "proveedores.ver",
    "presupuestos.ver",
    "presupuestos.crear",
    "presupuestos.editar",
    "presupuestos.confirmar",
    "clientes.ver",
    "clientes.crear",
    "clientes.editar",
    "vehiculos.ver",
    "vehiculos.crear",
    "vehiculos.editar",
    "notificaciones.ver",
  ],
  deposito: [
    "productos.ver",
    "presupuestos.ver",
    "presupuestos.preparar",
    "presupuestos.entregar",
    "series.ver",
    "series.mover",
    "operaciones.ver",
    "operaciones.crear",
    "notificaciones.ver",
    "ubicaciones.ver",
    "kits.ver",
  ],
  empleado: [
    "productos.ver",
    "piezas.ver",
    "proveedores.ver",
    "presupuestos.ver",
    "clientes.ver",
    "vehiculos.ver",
    "series.ver",
    "operaciones.ver",
    "notificaciones.ver",
    "categorias.ver",
    "subcategorias.ver",
    "marcas.ver",
    "ubicaciones.ver",
    "kits.ver",
  ],
} satisfies Record<Exclude<CanonicalRole, "admin">, AppPermission[]>;

const PERMISSIONS_BY_ROLE: Record<CanonicalRole, AppPermission[]> = {
  admin: [...ALL_PERMISSIONS],
  supervisor: UNIQUE_NON_ADMIN_PERMISSIONS.supervisor,
  catalogo: UNIQUE_NON_ADMIN_PERMISSIONS.catalogo,
  vendedor: UNIQUE_NON_ADMIN_PERMISSIONS.vendedor,
  deposito: UNIQUE_NON_ADMIN_PERMISSIONS.deposito,
  empleado: UNIQUE_NON_ADMIN_PERMISSIONS.empleado,
};

function getTargetRole(target: PermissionTarget): CanonicalRoleOrEmpty {
  if (!target) return "";
  if (typeof target === "string") return normalizeRole(target);
  return normalizeRole(target.rol);
}

export function normalizeRole(rol: string | null | undefined): CanonicalRoleOrEmpty {
  if (!rol) return "";

  const normalizedRole = rol.trim().toLowerCase();
  return CANONICAL_ROLES.includes(normalizedRole as CanonicalRole)
    ? (normalizedRole as CanonicalRole)
    : "";
}

export function getRolePermissions(role: PermissionTarget): AppPermission[] {
  const normalizedRole = getTargetRole(role);
  if (!normalizedRole) return [];
  return PERMISSIONS_BY_ROLE[normalizedRole];
}

export function tienePermiso(
  target: PermissionTarget,
  permission: AppPermission
): boolean {
  return getRolePermissions(target).includes(permission);
}

export function tieneAlgunPermiso(
  target: PermissionTarget,
  permissions: AppPermission[]
): boolean {
  return permissions.some((permission) => tienePermiso(target, permission));
}

export function tieneTodosLosPermisos(
  target: PermissionTarget,
  permissions: AppPermission[]
): boolean {
  return permissions.every((permission) => tienePermiso(target, permission));
}

export function esAdmin(target: PermissionTarget): boolean {
  return getTargetRole(target) === "admin";
}

export function puedeVerModulo(
  target: PermissionTarget,
  module: AppModule
): boolean {
  return tieneAlgunPermiso(target, VIEW_PERMISSIONS_BY_MODULE[module]);
}

export function canReadContent(rol: string | null | undefined): boolean {
  return normalizeRole(rol) !== "";
}

export function canManageContent(rol: string | null | undefined): boolean {
  return tieneAlgunPermiso(rol, CONTENT_MANAGEMENT_PERMISSIONS);
}
