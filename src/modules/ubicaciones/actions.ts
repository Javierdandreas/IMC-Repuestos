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

export async function listarUbicacionesPaginadasAction(params: { page?: number; pageSize?: number; search?: string; onlyLegacy?: boolean; onlyMulti?: boolean }) {
  const { listarUbicacionesPaginadas } = await import("./repos/ubicaciones");
  return await listarUbicacionesPaginadas(params);
}

export async function updateLegacyUbicacionAction(
  id: number | string,
  sector: string,
  est: number,
  niv: number,
  pos: number
) {
  const { getServerInternalUser } = await import("@/modules/auth/repos/auth");
  const { tienePermiso } = await import("@/modules/auth/repos/permissions");

  const user = await getServerInternalUser();
  if (!user || !user.activo || !tienePermiso(user.rol, "ubicaciones.editar")) {
    throw new Error("No tienes permisos para editar ubicaciones");
  }

  const { updateLegacyUbicacion } = await import("./repos/ubicaciones");
  const result = await updateLegacyUbicacion(id, sector, est, niv, pos);
  revalidatePath("/ubicaciones");
  return result;
}

export async function actualizarUbicacionAction(
  id: number | string,
  data: {
    descripcion?: string;
    sector_codigo?: string | null;
    estanteria?: number | null;
    nivel?: number | null;
    posicion?: number | null;
  }
) {
  const { getServerInternalUser } = await import("@/modules/auth/repos/auth");
  const { tienePermiso } = await import("@/modules/auth/repos/permissions");

  const user = await getServerInternalUser();
  if (!user || !user.activo || !tienePermiso(user.rol, "ubicaciones.editar")) {
    throw new Error("No tienes permisos para editar ubicaciones");
  }

  const { actualizarUbicacionEstructurada } = await import("./repos/ubicaciones");
  const result = await actualizarUbicacionEstructurada(id, data);
  revalidatePath("/ubicaciones");
  return result;
}

export async function detectarCodigosAction(texto: string) {
  const { detectarCodigosUbicacionEnTexto } = await import("./utils/parsing");
  return detectarCodigosUbicacionEnTexto(texto);
}

export async function obtenerProductosAsociadosAUbicacionAction(idUbicacion: number | string) {
  const { obtenerProductosAsociadosAUbicacion } = await import("@/modules/productos/repos/producto-ubicaciones");
  return await obtenerProductosAsociadosAUbicacion(idUbicacion);
}

export async function resolverUbicacionMultipleAction(params: {
  idLegacy: number;
  codigoParaActual: string;
  codigosAdicionales: string[];
  codigoPrincipal: string;
  productoIds: number[];
}) {
  const { getServerInternalUser } = await import("@/modules/auth/repos/auth");
  const { tienePermiso } = await import("@/modules/auth/repos/permissions");

  const user = await getServerInternalUser();
  if (!user || !user.activo || !tienePermiso(user.rol, "ubicaciones.editar") || !tienePermiso(user.rol, "productos.editar")) {
    throw new Error("No tienes permisos suficientes (ubicaciones y productos) para esta operación.");
  }

  const { resolverUbicacionMultipleRepo } = await import("./repos/ubicaciones");
  const result = await resolverUbicacionMultipleRepo(params);
  
  revalidatePath("/ubicaciones");
  revalidatePath("/productos");
  return result;
}


