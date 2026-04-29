import { Brand, Model } from "../types/vehiculos";

const BASE_URL = "https://argautos.com/api/v1";

// Cache local para evitar hits innecesarios
let brandsCache: Brand[] | null = null;
const modelsCache: Record<number, Model[]> = {};

/**
 * Obtiene la lista de marcas desde Arg Autos.
 */
export async function getMarcasOficiales(): Promise<Brand[]> {
  if (brandsCache) return brandsCache;

  try {
    const res = await fetch(`${BASE_URL}/brands?page=1`);
    const json = await res.json();
    brandsCache = json.data as Brand[];
    return brandsCache;
  } catch (error) {
    console.error("Error al obtener marcas de Arg Autos:", error);
    return [];
  }
}

/**
 * Obtiene la lista de modelos para una marca específica.
 */
export async function getModelosOficiales(brandId: number): Promise<Model[]> {
  if (modelsCache[brandId]) return modelsCache[brandId];

  try {
    const res = await fetch(`${BASE_URL}/brands/${brandId}/models`);
    const json = await res.json();
    modelsCache[brandId] = json.data as Model[];
    return modelsCache[brandId];
  } catch (error) {
    console.error(`Error al obtener modelos para la marca ${brandId}:`, error);
    return [];
  }
}

/**
 * Busca marcas que coincidan con el término.
 */
export async function buscarMarcasSugeridas(term: string): Promise<string[]> {
  const normalizedTerm = term.trim().toUpperCase();
  if (normalizedTerm.length < 2) return [];

  try {
    const marcas = await getMarcasOficiales();
    return marcas
      .filter(m => m.name.toUpperCase().includes(normalizedTerm))
      .map(m => m.name.toUpperCase())
      .sort((a, b) => {
        const aStarts = a.startsWith(normalizedTerm) ? 0 : 1;
        const bStarts = b.startsWith(normalizedTerm) ? 0 : 1;
        return aStarts - bStarts || a.localeCompare(b);
      })
      .slice(0, 10);
  } catch (e) {
    return [];
  }
}

/**
 * Busca modelos sugeridos para una marca específica.
 */
export async function buscarModelosSugeridos(marcaName: string, term: string): Promise<string[]> {
  const normalizedMarca = marcaName.trim().toUpperCase();
  const normalizedTerm = term.trim().toUpperCase();
  if (!normalizedMarca) return [];

  try {
    const marcas = await getMarcasOficiales();
    const brand = marcas.find(m => m.name.toUpperCase() === normalizedMarca);

    if (!brand) return [];

    const modelos = await getModelosOficiales(brand.id);
    
    const filtered = modelos
      .filter(m => m.name.toUpperCase().includes(normalizedTerm))
      .map(m => m.name.toUpperCase());

    if (normalizedTerm.length === 0) return filtered.slice(0, 20);

    return filtered
      .sort((a, b) => {
        const aStarts = a.startsWith(normalizedTerm) ? 0 : 1;
        const bStarts = b.startsWith(normalizedTerm) ? 0 : 1;
        return aStarts - bStarts || a.localeCompare(b);
      })
      .slice(0, 10);
  } catch (e) {
    return [];
  }
}

