export function canReadContent(rol: string | null | undefined): boolean {
  if (!rol) return false;
  const r = rol.toLowerCase();
  return r === "admin" || r === "empleado";
}

export function canManageContent(rol: string | null | undefined): boolean {
  if (!rol) return false;
  const r = rol.toLowerCase();
  return r === "admin";
}

export function normalizeRole(rol: string | null | undefined): "admin" | "empleado" | "" {
  if (!rol) return "";
  const r = rol.toLowerCase();
  if (r === "admin") return "admin";
  if (r === "empleado") return "empleado";
  return "";
}
