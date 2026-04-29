import { AuthenticatedInternalUser, CanonicalRole } from "./auth.types";

export type UserStatus = "active" | "inactive";

export interface UserManagementItem extends AuthenticatedInternalUser {
  // Campos extendidos para la UI de gestión si fueran necesarios
  // Por ahora reutilizamos la estructura canónica.
}

export interface PermissionDefinition {
  id: string;
  label: string;
  desc: string;
}

export const APP_ROLES: { id: CanonicalRole; label: string }[] = [
  { id: "admin", label: "Administrador" },
  { id: "supervisor", label: "Supervisor" },
  { id: "vendedor", label: "Vendedor / Mostrador" },
  { id: "deposito", label: "Encargado Depósito" },
  { id: "empleado", label: "Empleado Genérico" },
  { id: "catalogo", label: "Solo Catálogo" },
];
