import { getSubcategoriasConCategoria, createSubcategoria } from "../repos/subcategorias";
import { parseSubcategoriaPayload } from "../validators/subcategorias";

export class SubcategoriaService {
  /**
   * Obtiene la lista de subcategorÃas con su categorÃa padre
   */
  static async list() {
    return await getSubcategoriasConCategoria();
  }

  /**
   * Crea una nueva subcategorÃa
   */
  static async create(payload: any) {
    const validated = parseSubcategoriaPayload(payload);
    return await createSubcategoria(validated.descripcion, validated.id_categoria);
  }
}
