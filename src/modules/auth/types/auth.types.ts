export type AuthenticatedInternalUser = {
  authUserId: string;
  usuarioId: number;
  email: string | null;
  nombre: string | null;
  apellido: string | null;
  nombreUsuario: string | null;
  rol: "admin" | "empleado" | "";
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
