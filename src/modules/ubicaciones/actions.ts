"use server";

import { crearSector, generarUbicaciones } from "./repos/ubicaciones";
import { revalidatePath } from "next/cache";

export async function createSectorAction(codigo: string, descripcion?: string) {
  const result = await crearSector(codigo, descripcion);
  revalidatePath("/ubicaciones");
  return result;
}

export async function generateUbicacionesAction(
  sector: string,
  estanterias: number,
  niveles: number,
  posiciones: number
) {
  const result = await generarUbicaciones(sector, estanterias, niveles, posiciones);
  revalidatePath("/ubicaciones");
  return result;
}

export async function buscarUbicacionPorCodigoEscaneadoAction(valor: string) {
  const { buscarUbicacionPorCodigoEscaneado } = await import("./repos/ubicaciones");
  return await buscarUbicacionPorCodigoEscaneado(valor);
}

export async function asignarUbicacionMasivaAction(productoIds: number[], ubicacionId: number) {
  const { getServerInternalUser } = await import("@/modules/auth/repos/auth");
  const { tienePermiso } = await import("@/modules/auth/repos/permissions");
  
  const user = await getServerInternalUser();
  if (!user || !user.activo || !tienePermiso(user.rol, "productos.editar")) {
    throw new Error("No tienes permisos para editar productos");
  }

  const { asignarUbicacionAProductosMasivo } = await import("./repos/ubicaciones");
  const rowCount = await asignarUbicacionAProductosMasivo(productoIds, ubicacionId);
  revalidatePath("/productos");
  return rowCount;
}

export async function listarUbicacionesPaginadasAction(params: { page?: number; pageSize?: number; search?: string }) {
  const { listarUbicacionesPaginadas } = await import("./repos/ubicaciones");
  return await listarUbicacionesPaginadas(params);
}
