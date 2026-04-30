import { supabaseBrowser as supabase } from "@/utils/supabase/client";
import type { ProductoCatalogo } from "@/modules/presupuestos";

const SEARCH_PAGE_SIZE = 1000;
const SEARCH_MAX_RESULTS = 25000;

function mapProductoCatalogo(item: any): ProductoCatalogo {
  // Obtener precio de la L1 (MOSTRADOR)
  const preciosArr = Array.isArray(item.producto_precio) ? item.producto_precio : [];
  // Buscamos el precio que coincida con MOSTRADOR o simplemente el primero si no hay muchos
  const precioObj = preciosArr.find((p: any) => p.tipo_precio?.descripcion === 'MOSTRADOR' || p.tipo_precio?.descripcion === 'L1') || preciosArr[0];
  const precioFinal = precioObj ? Number(precioObj.precio) : 0;

  // El stock ahora viene directo de la columna productos.stock
  const totalStock = Number(item.stock) || 0;
  const ubicacionDesc = item.ubicaciones?.descripcion || "Sin Ubicación";

  return {
    codigo: item.cod_unico || "", 
    descripcion: item.descripcion || "Sin descripción",
    marca: item.marcas?.descripcion || "Desconocida", 
    precio: precioFinal,
    stock: totalStock,
    ubicacion: ubicacionDesc,
  } as ProductoCatalogo;
}

const PRODUCTO_SELECT_QUERY = `
  id,
  cod_unico,
  descripcion,
  marcas (descripcion),
  producto_precio (
    precio,
    tipo_precio (descripcion)
  ),
  stock,
  ubicaciones (
    descripcion
  )
`;

/**
 * Buscador de productos optimizado para el flujo de presupuestos.
 * Realiza una búsqueda flexible multipalabra en códigos, descripción y palabras clave.
 */
export async function buscarProductosEnGESU(termino: string): Promise<ProductoCatalogo[]> {
  const searchTerm = termino.trim();
  if (!searchTerm) return [];
  
  const words = searchTerm.split(/\s+/).filter(Boolean);

  // 1. Consultar productos por campos básicos (Modo flexible multipalabra)
  let query = supabase
    .from("productos")
    .select(PRODUCTO_SELECT_QUERY);

  // Aplicamos un filtro .or por cada palabra para que sea AND entre ellas
  words.forEach((word) => {
    const cleanWord = `%${word}%`;
    query = query.or(
      `cod_unico.ilike.${cleanWord},descripcion.ilike.${cleanWord},palabra_clave.ilike.${cleanWord}`
    );
  });

  const promiseProductos = query
    .order("cod_unico", { ascending: true })
    .limit(SEARCH_MAX_RESULTS);

  // 2. Consultar palabras clave
  let keywordQuery = supabase
    .from("productos")
    .select("id");

  words.forEach((word) => {
    keywordQuery = keywordQuery.ilike("palabra_clave", `%${word}%`);
  });

  // 3. Consultar códigos de proveedor
  let fuentesQuery = supabase
    .from("producto_proveedor")
    .select("id_producto");

  words.forEach((word) => {
    fuentesQuery = fuentesQuery.ilike("codigo_proveedor", `%${word}%`);
  });

  const [resProd, resKeys, resFuentes] = await Promise.all([
    promiseProductos,
    keywordQuery.limit(1000),
    fuentesQuery.limit(1000),
  ]);

  let items: any[] = resProd.data || [];
  const existingIds = new Set(items.map((i: any) => i.id));

  // Consolidar IDs de palabras clave y proveedores
  const additionalIds = Array.from(
    new Set([
      ...(resKeys.data || []).map((k: any) => k.id),
      ...(resFuentes.data || []).map((f: any) => f.id_producto),
    ])
  ).filter((id) => id && !existingIds.has(id));

  // 4. Traer los productos adicionales encontrados
  if (additionalIds.length > 0) {
    const { data: moreProds } = await supabase
      .from("productos")
      .select(PRODUCTO_SELECT_QUERY)
      .in("id", additionalIds);

    if (moreProds) {
      items = [...items, ...moreProds];
    }
  }

  return items
    .sort(
      (a: any, b: any) =>
        (b.tipo || "").localeCompare(a.tipo || "") ||
        (a.cod_unico || a.codigo || "").localeCompare(b.cod_unico || b.codigo || "")
    )
    .slice(0, SEARCH_MAX_RESULTS)
    .map(mapProductoCatalogo);
}

/**
 * Búsqueda exacta de productos por palabra clave (normalmente códigos).
 */
export async function buscarProductosExacto(termino: string): Promise<ProductoCatalogo[]> {
  const searchTerm = termino.trim().replace(/\s+/g, "");
  if (!searchTerm) return [];

  const { data: resKeys } = await supabase
    .from("productos")
    .select("id")
    .or(
      `palabra_clave.ilike.${searchTerm},palabra_clave.ilike.${searchTerm} %,palabra_clave.ilike.% ${searchTerm},palabra_clave.ilike.% ${searchTerm} %`
    );

  if (!resKeys || resKeys.length === 0) return [];

  const uniqueIds = Array.from(new Set(resKeys.map((k: any) => k.id)));

  const { data: rawItems } = await supabase
    .from("productos")
    .select(PRODUCTO_SELECT_QUERY)
    .in("id", uniqueIds);

  const items: any[] = rawItems || [];

  return items
    .sort(
      (a: any, b: any) =>
        (a.cod_unico || "").localeCompare(b.cod_unico || "")
    )
    .map(mapProductoCatalogo);
}

/**
 * Obtiene una lista de productos por sus códigos únicos o legacy.
 */
export async function obtenerProductosPorCodigos(codigos: string[]): Promise<ProductoCatalogo[]> {
  if (!codigos.length) return [];

  const { data, error } = await supabase
    .from("productos")
    .select(PRODUCTO_SELECT_QUERY)
    .or(`cod_unico.in.(${codigos.join(',')})`);

  if (error) {
    console.error("Error obteniendo productos por códigos en Supabase:", error);
    return [];
  }

  if (!data) return [];

  return data.map(mapProductoCatalogo);
}

/**
 * Realiza una búsqueda masiva de múltiples códigos en paralelo.
 */
export async function buscarMasivoProductos(codigos: string[]): Promise<ProductoCatalogo[]> {
  if (!codigos.length) return [];

  const promiseProds = supabase
    .from("productos")
    .select(PRODUCTO_SELECT_QUERY)
    .or(`cod_unico.in.(${codigos.join(',')})`);

  const promiseFuentes = supabase
    .from("producto_proveedor")
    .select("id_producto")
    .in("codigo_proveedor", codigos);

  let keywordFilter = "";
  codigos.forEach((code, idx) => {
    const part = `palabra_clave.ilike.${code},palabra_clave.ilike.${code} %,palabra_clave.ilike.% ${code},palabra_clave.ilike.% ${code} %`;
    keywordFilter += (idx === 0 ? "" : ",") + part;
  });

  const promiseKeys = supabase
    .from("productos")
    .select("id")
    .or(keywordFilter);

  const [resProd, resFuentes, resKeys] = await Promise.all([
    promiseProds,
    promiseFuentes,
    promiseKeys,
  ]);

  let items: any[] = resProd.data || [];
  const existingIds = new Set(items.map((i: any) => i.id));

  const otherIds = [
    ...(resFuentes.data || []).map((f: any) => f.id_producto),
    ...(resKeys.data || []).map((k: any) => k.id),
  ].filter((id) => !existingIds.has(id));

  if (otherIds.length > 0) {
    const uniqueIds = Array.from(new Set(otherIds));
    const { data: moreProds } = await supabase
      .from("productos")
      .select(PRODUCTO_SELECT_QUERY)
      .in("id", uniqueIds);

    if (moreProds) {
      items = [...items, ...moreProds];
    }
  }

  return items.map(mapProductoCatalogo);
}
