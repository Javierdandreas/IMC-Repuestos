import { getOperaciones, createOperacion } from "../repos/operaciones";
import { AppError } from "@/lib/api-errors";

export class OperacionService {
  /**
   * Obtiene la lista de operaciones con filtros
   */
  static async listOperaciones(filters: { tipo?: "COMPRA" | "VENTA" | "AJUSTE"; limit?: number }) {
    return await getOperaciones(filters);
  }

  /**
   * Crea una nueva operaciÃ³n (Compra, Venta, Ajuste)
   */
  static async create(payload: any, usuarioId: number) {
    if (!payload.tipo || !['COMPRA', 'VENTA', 'AJUSTE'].includes(payload.tipo.toUpperCase())) {
      throw new AppError("Tipo de operaciÃ³n invÃ¡lido.", 400);
    }
    
    if (!payload.detalles || payload.detalles.length === 0) {
      throw new AppError("La operaciÃ³n debe incluir al menos un detalle.", 400);
    }

    const finalPayload = {
      ...payload,
      tipo: payload.tipo.toUpperCase(),
      usuario_id: usuarioId,
    };

    return await createOperacion(finalPayload);
  }
}
