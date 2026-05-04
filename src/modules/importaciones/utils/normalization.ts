/**
 * Utilidades para normalizar datos provenientes de archivos externos (CSV/XLSX)
 */

export class Normalizer {
  /**
   * Convierte un valor a número, manejando formatos argentinos ($ 1.234,56),
   * porcentajes (15%) y celdas vacías.
   */
  static toNumber(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    
    let str = String(value).trim().toUpperCase();
    if (!str || str === 'NULL' || str === 'UNDEFINED') return null;

    // Eliminar símbolos de moneda y espacios
    str = str.replace(/[$\s]/g, '');
    
    // Eliminar el símbolo de porcentaje si existe
    str = str.replace('%', '');

    // Manejar formato argentino: "." como miles, "," como decimal
    // Si tiene coma y punto, asumimos que el punto es miles
    if (str.includes(',') && str.includes('.')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else if (str.includes(',')) {
      // Si solo tiene coma, asumimos que es el decimal
      str = str.replace(',', '.');
    }

    const n = parseFloat(str);
    return isNaN(n) ? null : n;
  }

  /**
   * Normaliza un código eliminando espacios, guiones y convirtiendo a mayúsculas,
   * pero preservando ceros a la izquierda.
   */
  static toCode(value: any): string | null {
    if (value === null || value === undefined || value === '') return null;
    
    let str = String(value).trim().toUpperCase();
    if (!str || str === 'NULL' || str === 'UNDEFINED') return null;

    // Eliminar guiones y espacios internos (opcional, según criterio del usuario)
    // El usuario pidió: "00123" debe conservar ceros. "códigos con espacios" "códigos con guiones"
    // Mantendremos los guiones por ahora si son significativos, pero eliminaremos espacios.
    str = str.replace(/\s+/g, '');
    
    return str;
  }

  /**
   * Normaliza texto básico (descripción, marca, etc)
   */
  static toText(value: any, maxLength?: number): string | null {
    if (value === null || value === undefined || value === '') return null;
    
    let str = String(value).trim();
    if (!str || str.toUpperCase() === 'NULL') return null;

    if (maxLength && str.length > maxLength) {
      str = str.substring(0, maxLength);
    }
    
    return str;
  }

  /**
   * Normaliza stock. Si es texto como "SIN STOCK", devuelve 0.
   */
  static toStock(value: any): number {
    const n = this.toNumber(value);
    if (n !== null) return n;

    const str = String(value).trim().toUpperCase();
    if (['SIN STOCK', 'AGOTADO', 'NO', 'OUT OF STOCK'].includes(str)) {
      return 0;
    }

    return 0;
  }
}
