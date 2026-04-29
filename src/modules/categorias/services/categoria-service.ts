import { getCategorias, createCategoria } from "../repos/categorias";
import { parseCategoriaDescripcion } from "../validators/categorias";

export class CategoriaService {
  /**
   * Obtiene la lista completa de categorÃas
   */
  static async list() {
    return await getCategorias();
  }

  /**
   * Crea una nueva categorÃa
   */
  static async create(payload: any) {
    const validated = parseCategoriaDescripcion(payload);
    return await createCategoria(validated.descripcion);
  }
}
