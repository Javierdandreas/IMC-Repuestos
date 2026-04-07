export type AppRole = string | null | undefined;
export type NormalizedAppRole = "admin" | "empleado" | "";

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

export function canManageContent(role: AppRole): boolean {
  return normalizeRole(role) === "admin";
}

export function canReadContent(role: AppRole): boolean {
  const normalized = normalizeRole(role);
  return normalized === "admin" || normalized === "empleado";
}

export function isEmpleado(role: AppRole): boolean {
  return normalizeRole(role) === "empleado";
}
