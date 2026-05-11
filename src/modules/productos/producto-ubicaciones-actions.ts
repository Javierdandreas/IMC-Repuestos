"use server";

import { 
  listarUbicacionesDeProducto as listRepo, 
  agregarUbicacionAProducto as addRepo, 
  quitarUbicacionDeProducto as removeRepo, 
  marcarUbicacionPrincipal as setPrincipalRepo,
  asignarUbicacionAProductosMasivo as bulkRepo,
} from "./repos/producto-ubicaciones";
import { revalidatePath } from "next/cache";
import { getServerInternalUser } from "@/modules/auth/repos/auth";
import { tienePermiso } from "@/modules/auth/repos/permissions";

async function ensureEditPermission() {
  const user = await getServerInternalUser();
  if (!user || !user.activo || !tienePermiso(user.rol, "productos.editar")) {
    throw new Error("No tienes permisos para realizar esta acción.");
  }
}

export async function listarUbicacionesDeProductoAction(idProducto: number | string) {
  try {
    return await listRepo(idProducto);
  } catch (error) {
    console.error("Error al listar ubicaciones de producto:", error);
    throw new Error("No se pudieron obtener las ubicaciones.");
  }
}

export async function agregarUbicacionAProductoAction(idProducto: number | string, idUbicacion: number | string) {
  try {
    await ensureEditPermission();
    const res = await addRepo(idProducto, idUbicacion);
    revalidatePath(`/productos/edit/${idProducto}`);
    return res;
  } catch (error) {
    console.error("Error al agregar ubicación a producto:", error);
    throw new Error("No se pudo agregar la ubicación.");
  }
}

export async function quitarUbicacionDeProductoAction(idProducto: number | string, idUbicacion: number | string) {
  try {
    await ensureEditPermission();
    await removeRepo(idProducto, idUbicacion);
    revalidatePath(`/productos/edit/${idProducto}`);
  } catch (error) {
    console.error("Error al quitar ubicación de producto:", error);
    throw new Error("No se pudo quitar la ubicación.");
  }
}

export async function marcarUbicacionPrincipalAction(idProducto: number | string, idUbicacion: number | string) {
  try {
    await ensureEditPermission();
    const res = await setPrincipalRepo(idProducto, idUbicacion);
    revalidatePath(`/productos/edit/${idProducto}`);
    return res;
  } catch (error) {
    console.error("Error al marcar ubicación principal:", error);
    throw new Error("No se pudo marcar como principal.");
  }
}

export async function asignarUbicacionAProductosMasivoAction(
  productoIds: (number | string)[], 
  idUbicacion: number | string, 
  modo: 'agregar_adicional' | 'marcar_principal' | 'reemplazar_todas'
) {
  try {
    await ensureEditPermission();
    await bulkRepo(productoIds, idUbicacion, modo);
    revalidatePath("/");
  } catch (error) {
    console.error("Error en asignación masiva de ubicaciones:", error);
    throw new Error("Error en la operación masiva.");
  }
}
