import { CedulaData } from "../types/vehiculos";

/**
 * Procesa una imagen de Cédula de Identificación de Vehículo (Argentina)
 * Llama al API Route del servidor (que tiene la key segura y sin restricciones de origen)
 */
export async function procesarImagenCedula(imagen: File): Promise<CedulaData | null> {
  try {
    const formData = new FormData();
    formData.append("image", imagen);

    const response = await fetch("/api/presupuestos/scan-cedula", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Error del servidor al procesar cédula:", errorData.error || errorData);
      return null;
    }

    const data = await response.json() as CedulaData;
    return data;
  } catch (error) {
    console.error("Error al llamar al API de escaneo:", error);
    return null;
  }
}

