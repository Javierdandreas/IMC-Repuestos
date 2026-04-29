import type { RolUsuarioPresupuestos as RolUsuario } from "../types/auth-presupuestos";

/**
 * @deprecated Compatibilidad temporal para superficies legacy.
 * Las superficies activas deben decidir permisos con `src/modules/auth/repos/permissions.ts`.
 * TODO: eliminar cuando Presupuestos deje de depender de roles legacy.
 */
export function puedeCrearEditarPresupuesto(rol: RolUsuario) {
  return rol === "mostrador" || rol === "administrador";
}

export function puedeConfirmarPresupuesto(rol: RolUsuario) {
  return rol === "mostrador" || rol === "administrador";
}

export function puedePrepararDeposito(rol: RolUsuario) {
  return rol === "deposito" || rol === "administrador";
}

export function puedeVerConfirmados(rol: RolUsuario) {
  return (
    rol === "mostrador" || rol === "deposito" || rol === "administrador"
  );
}

export function puedeVerUbicacion(rol: RolUsuario) {
  return rol === "deposito" || rol === "administrador";
}

