import { createImportacion } from "../repos/proveedor-importaciones";
import { getImportacionesLogs } from "@/modules/productos/repos/productos";
import { CreateImportacionInput } from "../types/importaciones";
import { AppError } from "@/lib/api-errors";

export class ImportacionService {
  /**
   * Procesa una importaciÃ³n de proveedor
   */
  static async importarDeProveedor(input: CreateImportacionInput) {
    if (!input.id_proveedor) {
      throw new AppError("ID de proveedor es requerido", 400);
    }

    if (!input.items || !Array.isArray(input.items) || input.items.length === 0) {
      throw new AppError("La lista de Ãtems es requerida y debe ser un array no vacÃo", 400);
    }

    return await createImportacion(input);
  }

  /**
   * Obtiene el historial de logs de importaciones
   */
  static async listLogs(page: number, limit: number) {
    return await getImportacionesLogs(page, limit);
  }
}
