import { getPiezasListado, createPieza, getPiezasParaExportar } from "../repos/piezas";
import { validatePiezaPayload } from "../validators/piezas";
import Papa from "papaparse";
import * as XLSX from "xlsx";

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

  /**
   * Genera datos para exportaciÃ³n en formato CSV o Excel
   */
  static async exportPiezas(format: string) {
    const data = await getPiezasParaExportar();

    if (format === "excel") {
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Piezas");
      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
      
      return {
        content: buffer,
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename: `piezas_export_${new Date().toISOString().split('T')[0]}.xlsx`
      };
    }

    // Default: CSV
    const csv = Papa.unparse(data, {
      header: true,
      skipEmptyLines: true,
    });
    const BOM = "\uFEFF";
    const csvWithBOM = BOM + csv;

    return {
      content: csvWithBOM,
      contentType: "text/csv; charset=utf-8",
      filename: `piezas_export_${new Date().toISOString().split('T')[0]}.csv`
    };
  }
}
