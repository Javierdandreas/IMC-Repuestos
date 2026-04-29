import { getKitsListado, createKit } from "../repos/kits";
import { AppError } from "@/lib/api-errors";

export class KitService {
  /**
   * Obtiene la lista paginada de kits
   */
  static async list(page: number, limit: number, search?: string) {
    return await getKitsListado(page, limit, search);
  }

  /**
   * Crea un nuevo kit con sus componentes
   */
  static async create(payload: any) {
    if (!payload.nombre || !payload.codigo_kit || !payload.componentes || payload.componentes.length === 0) {
      throw new AppError("Nombre, cÃ³digo y componentes son requeridos", 400);
    }

    return await createKit(payload);
  }
}
