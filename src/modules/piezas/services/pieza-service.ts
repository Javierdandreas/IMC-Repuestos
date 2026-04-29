import { getPiezasListado, createPieza } from "../repos/piezas";
import { validatePiezaPayload } from "../validators/piezas";

export class PiezaService {
  /**
   * Obtiene la lista paginada de piezas
   */
  static async list(page: number, limit: number) {
    return await getPiezasListado(page, limit);
  }

  /**
   * Crea una nueva pieza vinculada a un producto
   */
  static async create(payload: any) {
    const validated = validatePiezaPayload(payload);
    return await createPieza(validated);
  }
}
