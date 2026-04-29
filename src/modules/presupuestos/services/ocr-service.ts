import { GoogleGenerativeAI } from "@google/generative-ai";
import { AppError } from "@/lib/api-errors";

export class OcrService {
  /**
   * Obtiene la lista de modelos de Gemini disponibles que soportan imÃ¡genes
   */
  static async listModels() {
    const API_KEY = process.env.GEMINI_API_KEY || "";

    if (!API_KEY) {
      throw new AppError("No hay API Key", 500);
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`
    );
    const data = await response.json();
    
    return (data.models || [])
      .filter((m: { supportedGenerationMethods?: string[] }) => 
        m.supportedGenerationMethods?.includes("generateContent")
      )
      .map((m: { name: string; displayName?: string }) => ({
        name: m.name,
        displayName: m.displayName,
      }));
  }

  /**
   * Escanea una imagen de cÃ©dula y extrae informaciÃ³n del vehÃculo
   */
  static async scanCedula(imageFile: File) {
    const API_KEY = process.env.GEMINI_API_KEY || "";

    if (!API_KEY) {
      throw new AppError("API Key de Gemini no configurada en el servidor.", 500);
    }

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    const bytes = await imageFile.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");

    const prompt = `
      Vas a analizar una imagen de una cÃ©dula de identificaciÃ³n de vehÃculo (Argentina).

      OBJETIVO:
      Extraer la PATENTE, MARCA, MODELO y el nÃºmero de CHASIS/CUADRO (VIN) de forma extremadamente precisa.

      ESTRUCTURA DE LA CÃ‰DULA:
      - El NÃšMERO GRANDE en la parte superior (ej: AR089291) es el NÃšMERO DE SERIE DEL DOCUMENTO. IGNORALO para la patente.
      - El campo "DOMINIO" = PATENTE REAL del vehÃculo.
          * En autos viejos: 3 Letras + 3 NÃºmeros.
          * En autos nuevos: 2 Letras + 3 NÃºmeros + 2 Letras.
          * En motos: 3 NÃºmeros + 3 Letras (Ej: 011LHY. Empieza con CERO numÃ©rico, no letra O) o 1 Letra + 3 NÃºmeros + 3 Letras.
      - El campo "MARCA" = marca del fabricante.
      - El campo "MODELO" = modelo del vehÃculo.
      - El campo "CHASIS" (o "CUADRO" si es una moto) = nÃºmero VIN.

      REGLAS IMPORTANTES PARA EL CHASIS/CUADRO (VIN):

      1. UBICACIÃ“N
      - Aparece junto a la palabra "CHASIS" o "CUADRO".
      - IgnorÃ¡ por completo el campo "MOTOR".

      2. FORMATO DEL VIN
      - Debe tener exactamente 17 caracteres.
      - Solo letras mayÃºsculas (A-Z) y nÃºmeros (0-9).
      - NO puede contener las letras: I, O, Q.

      3. TÃ‰CNICA DE LECTURA ANTI-ERRORES (MUY IMPORTANTE)
      - Para evitar invertir letras contiguas (como confundir GC con CG), leÃ© el cÃ³digo AGRUPÃNDOLO DE A 4 CARACTERES mentalmente.
      - Ejemplo: Si ves "8BCGC9HX...", leelo como "8BCG" - "C9HX" - "CCG5" - "1625" - "2". 
      - Esta tÃ©cnica evita que transpongas letras. Â¡TranscribÃ el resultado final todo junto pero usÃ¡ esta tÃ©cnica para leerlo!

      4. AMBIGÃœEDADES COMUNES
      - Si dudÃ¡s entre caracteres similares, indicarlo usando una barra.
        Ejemplo de cÃ³mo reportarlo en posiciones_ambiguas:
          - "C/G"
          - "B/8"
          - "S/5"
      - Si hay un destello de luz o reflejo sobre una letra y no podÃ©s adivinarla, usÃ¡ "?".
      - NO elijis una opciÃ³n a ciegas.

      5. PROBLEMAS VISUALES
      - TenÃ© en cuenta reflejos del plÃ¡stico y sombras.

      6. SALIDA REQUERIDA (JSON ESTRICTO)

      Responder Ãºnicamente en este formato:

      {
        "patente": "string",
        "marca": "string",
        "modelo": "string",
        "vin_detectado": "string",
        "longitud": number,
        "valido_formato": true/false,
        "tiene_caracteres_invalidos": true/false,
        "contiene_ambiguos": true/false,
        "posiciones_ambiguas": [
          { "posicion": number, "opciones": ["C","G"] }
        ],
        "confianza_general": "alta | media | baja"
      }

      7. VALIDACIONES DEL JSON
      - "valido_formato" = true solo si tiene 17 caracteres vÃ¡lidos.
      - "tiene_caracteres_invalidos" = true si aparece I, O o Q en el vin_detectado.
      - "contiene_ambiguos" = true si usaste "?" o "/" en el vin_detectado.

      IMPORTANTE:
      - No expliquÃ©is nada fuera del JSON.
      - No agreguÃ©is texto adicional.
    `;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64,
          mimeType: imageFile.type || "image/jpeg",
        },
      },
    ]);

    const rawText = result.response.text().trim();
    const jsonText = rawText
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    const data = JSON.parse(jsonText);

    // Post-procesado del chasis
    let chasis = (data.vin_detectado || "").toUpperCase().replace(/[^A-Z0-9\?]/g, "");
    chasis = chasis.replace(/[IOQ]/g, (c: string) => c === "I" ? "1" : "0");

    return {
      patente: (data.patente || "").toUpperCase().replace(/[^A-Z0-9]/g, ""),
      marca: (data.marca || "").toUpperCase(),
      modelo: (data.modelo || "").toUpperCase(),
      chasis: chasis,
    };
  }
}
