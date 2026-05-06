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
