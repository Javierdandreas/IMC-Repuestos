export interface UbicacionCandidate {
  raw: string;
  sector: string;
  estanteria: number;
  nivel: number;
  posicion: number;
  codigo: string;
  completo: boolean;
}

/**
 * Detecta candidatos de ubicaciones estructuradas en un texto.
 * Formato esperado: Letra + Numero + "-" + Numero + "-" + Numero (ej: D8-4-1)
 */
export function detectarCodigosUbicacionEnTexto(texto: string | null | undefined): UbicacionCandidate[] {
  if (!texto) return [];
  
  // Regex: Palabra que empieza con una letra, seguida de numeros, guion, numeros, guion, numeros.
  // Usamos boundaries \b para evitar detectar partes de palabras.
  const regex = /\b([A-Za-z])(\d+)-(\d+)-(\d+)\b/g;
  const candidates: UbicacionCandidate[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(texto)) !== null) {
    const sector = match[1].toUpperCase();
    const est = parseInt(match[2], 10);
    const niv = parseInt(match[3], 10);
    const pos = parseInt(match[4], 10);

    // Validamos que sean numeros validos (mayores o iguales a 0)
    if (!isNaN(est) && !isNaN(niv) && !isNaN(pos)) {
      candidates.push({
        raw: match[0],
        sector,
        estanteria: est,
        nivel: niv,
        posicion: pos,
        codigo: `${sector}${est}-${niv}-${pos}`,
        completo: true
      });
    }
  }

  return candidates;
}
