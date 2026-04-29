import { getPaginatedCatalogo, createCatalogo } from "@/modules/core/repos/catalogos-base";

export class CatalogoService {
  /**
   * Obtiene datos paginados de un catÃ¡logo especÃfico
   */
  static async getPaginated(table: "marcas" | "proveedores" | "ubicaciones", page: number, limit: number) {
    return await getPaginatedCatalogo(table, page, limit);
  }

  /**
   * Crea un nuevo registro en un catÃ¡logo especÃfico
   */
  static async create(table: "marcas" | "proveedores" | "ubicaciones", descripcion: string) {
    return await createCatalogo(table, descripcion);
  }
}
