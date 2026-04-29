export type CanonicalRole =
  | "admin"
  | "supervisor"
  | "catalogo"
  | "vendedor"
  | "deposito"
  | "empleado";

export type CanonicalRoleOrEmpty = CanonicalRole | "";

export type AuthenticatedInternalUser = {
  authUserId: string;
  usuarioId: number;
  email: string | null;
  nombre: string | null;
  apellido: string | null;
  nombreUsuario: string | null;
  rol: CanonicalRoleOrEmpty;
  activo: boolean;
};

export type InternalUserRow = {
  authUserId: string;
  usuarioId: number;
  email: string | null;
  nombre: string | null;
  apellido: string | null;
  nombreUsuario: string | null;
  rol: string | null;
  activo: boolean | null;
};
