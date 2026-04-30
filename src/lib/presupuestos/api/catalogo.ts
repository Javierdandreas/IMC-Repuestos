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
    codigo: item.cod_unico || item.codigo || "", // Fallback a codigo legacy si cod_unico está vacío
    descripcion: item.descripcion || "Sin descripción",
    marca: item.marcas?.descripcion || item.marca || "Desconocida", // Fallback a marca legacy
    precio: precioFinal,
    stock: totalStock,
    ubicacion: ubicacionDesc,
  } as ProductoCatalogo;
}

const PRODUCTO_SELECT_QUERY = `
  id,
  cod_unico,
  codigo,
  descripcion,
  marca,
  marcas (descripcion),
  tipo,
  producto_precio (
    precio,
    tipo_precio (descripcion)
  ),
  stock,
  ubicaciones (
    descripcion
  )
`;

export async function buscarProductosEnGESU(termino: string): Promise<ProductoCatalogo[]> {
  const searchTerm = termino.trim();
  if (!searchTerm) return [];
  const cleanTerm = `%${searchTerm}%`;

  const words = searchTerm.split(/\s+/).filter(Boolean);

  // 1. Consultar productos por campos básicos (Modo flexible multipalabra)
  let query = supabase
    .from("productos")
    .select(PRODUCTO_SELECT_QUERY);

  // Aplicamos un filtro .or por cada palabra para que sea AND entre ellas
  words.forEach((word) => {
    const cleanWord = `%${word}%`;
    // Buscamos en cod_unico (nuevo), codigo (legacy), descripcion, y marca (legacy)
    // Para buscar en marcas.descripcion (relación) PostgREST es más complejo en .or directo si no es !inner
    query = query.or(
      `cod_unico.ilike.${cleanWord},codigo.ilike.${cleanWord},descripcion.ilike.${cleanWord},marca.ilike.${cleanWord},palabra_clave.ilike.${cleanWord}`
    );
  });

  const promiseProductos = query
    .order("tipo", { ascending: false })
    .order("codigo", { ascending: true })
    .limit(100);

  // 2. Consultar palabras clave (Modo flexible multipalabra)
  let keywordQuery = supabase
    .from("productos")
    .select("id");

  words.forEach((word) => {
    keywordQuery = keywordQuery.ilike("palabra_clave", `%${word}%`);
  });

  const promiseKeywords = keywordQuery.limit(1000);

  // 3. Consultar códigos de proveedor (NUEVO - Modo flexible multipalabra)
  let fuentesQuery = supabase
    .from("producto_proveedor")
    .select("id_producto");

  words.forEach((word) => {
    fuentesQuery = fuentesQuery.ilike("codigo_proveedor", `%${word}%`);
  });

  const promiseFuentes = fuentesQuery.limit(1000);

  const [resProd, resKeys, resFuentes] = await Promise.all([
    promiseProductos,
    keywordQuery, // Reutilizamos el query construido
    fuentesQuery, // Reutilizamos el query construido
  ]);

  let items: any[] = resProd.data || [];
  const existingIds = new Set(items.map((i: any) => i.id));

  // Consolidar IDs de palabras clave y proveedores
  const additionalIds = Array.from(
    new Set([
      ...(resKeys.data || []).map((k: any) => k.id), // Ahora es de la tabla productos
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

export async function buscarProductosExacto(termino: string): Promise<ProductoCatalogo[]> {
  // NORMALIZACIÓN: Quitar espacios al código para busca en palabras clave
  const searchTerm = termino.trim().replace(/\s+/g, "");
  if (!searchTerm) return [];

  // BUSCADOR EXACTO: Apunta a palabra_clave en productos
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
        (b.tipo || "").localeCompare(a.tipo || "") ||
        (a.cod_unico || a.codigo || "").localeCompare(b.cod_unico || b.codigo || "")
    )
    .map(mapProductoCatalogo);
}

export async function obtenerProductosPorCodigos(codigos: string[]): Promise<ProductoCatalogo[]> {
  if (!codigos.length) return [];

  const { data, error } = await supabase
    .from("productos")
    .select(
      `
      id,
      cod_unico,
      codigo,
      descripcion,
      marca,
      marcas (descripcion),
      producto_precio (
        precio,
        tipo_precio (descripcion)
      ),
      stock,
      ubicaciones (
        descripcion
      )
    `
    )
    .or(`cod_unico.in.(${codigos.join(',')}),codigo.in.(${codigos.join(',')})`);

  if (error) {
    console.error("Error obteniendo productos por códigos en Supabase:", error);
    return [];
  }

  if (!data) return [];

  return data.map(mapProductoCatalogo);
}

export async function buscarMasivoProductos(codigos: string[]): Promise<ProductoCatalogo[]> {
  if (!codigos.length) return [];

  // Ejecutamos búsquedas en paralelo para ser ultra rápidos
  const promiseProds = supabase
    .from("productos")
    .select(PRODUCTO_SELECT_QUERY)
    .or(`cod_unico.in.(${codigos.join(',')}),codigo.in.(${codigos.join(',')})`);

  // Query 2: Product Sources
  const promiseFuentes = supabase
    .from("producto_proveedor")
    .select("id_producto")
    .in("codigo_proveedor", codigos);

  // Query 3: Keywords - Construimos una query OR robusta para detectar cada código
  // incluso si la fila de palabras clave tiene múltiples valores separados por espacios
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

  // Consolidar IDs de fuentes y palabras clave que no tengamos ya
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

export { dispararSincronizacionGesu, obtenerEstadoSincronizacion } from "@/modules/sync";

