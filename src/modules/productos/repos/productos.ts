import { query, withTransaction, paginateQuery } from "@/lib/db-utils";
import { pool } from "@/utils/database";
import type { Producto, ProductoListado, ProveedorProducto, Subcategoria } from "@/modules/productos/types/productos";
import type { DbClient } from "@/lib/db-utils";
import { 
  sanitizeNullableString, 
  sanitizeRequiredString, 
  sanitizeStock 
} from "@/utils/sanitization";
import { deleteFileFromStorage } from "@/lib/storage-cleanup";

export type ProductoInput = {
  cod_unico: string;
  descripcion: string;
  cod_barra?: string | null;
  stock?: number;
  id_pieza?: number | null;
  id_subcategoria: number;
  id_marca?: number | null;
  id_ubicacion?: number | null;
  imagen_url?: string | null;
  proveedores?: ProveedorProducto[];
  usa_numero_serie?: boolean;
  palabra_clave?: string | null;
  precios?: { id_tipo_precio: number; valor: number; porcentaje_ganancia: number }[];
};


export type ImportProductoInput = {
  cod_unico?: string;
  codigoInterno?: string;
  descripcion?: string;
  titulo?: string;
  cod_barra?: string | null;
  CodigoBarras?: string | null;
  stock?: number;
  marca?: string | null;
  categoria?: string | null;
  subcategoria?: string | null;
  ubicacion?: string | null;
  ubicacionInt?: string | null;
  codigo_pieza?: string | null;
  palabra_clave?: string | null;
  "Palabra clave"?: string | null;
  codigoProveedor?: string | null;
  Proveedor?: string | null;
};


function sanitizeProductoInput(input: ProductoInput) {
  return {
    cod_unico: sanitizeRequiredString(input.cod_unico),
    descripcion: sanitizeRequiredString(input.descripcion),
    cod_barra: sanitizeNullableString(input.cod_barra),
    stock: sanitizeStock(input.stock),
    id_pieza: input.id_pieza || null,
    id_subcategoria: input.id_subcategoria,
    id_marca: input.id_marca || null,
    id_ubicacion: input.id_ubicacion || null,
    imagen_url: sanitizeNullableString(input.imagen_url),
    proveedores: Array.isArray(input.proveedores) ? input.proveedores : [],
    usa_numero_serie: Boolean(input.usa_numero_serie),
    palabra_clave: input.id_pieza ? null : sanitizeNullableString(input.palabra_clave),
    precios: Array.isArray(input.precios) ? input.precios : [],
  };
}

async function syncProductoPrecios(
  client: DbClient,
  productId: number | string,
  precios: { id_tipo_precio: number; valor: number; porcentaje_ganancia: number }[]
) {
  // Solo sincronizar si vienen precios
  if (!precios || precios.length === 0) return;

  await client.query("DELETE FROM producto_precio WHERE id_producto = $1", [productId]);

  for (const item of precios) {
    if (!item.id_tipo_precio) continue;
    await client.query(
      `
        INSERT INTO producto_precio (id_producto, id_tipo_precio, precio, porcentaje_ganancia)
        VALUES ($1, $2, $3, $4)
      `,
      [productId, item.id_tipo_precio, item.valor, item.porcentaje_ganancia || 0]
    );

  }
}

async function getProductoPrecios(id: string | number) {
  const querySql = `
    SELECT
      pp.id_tipo_precio,
      tp.descripcion AS tipo_descripcion,
      pp.precio AS valor,
      COALESCE(pp.porcentaje_ganancia, 0) AS porcentaje_ganancia
    FROM producto_precio pp

    JOIN tipo_precio tp ON tp.id = pp.id_tipo_precio
    WHERE pp.id_producto = $1
    ORDER BY tp.id
  `;

  const { rows } = await query(querySql, [id]);
  return rows;
}


async function syncProductoProveedores(
  client: DbClient,
  productId: number | string,
  proveedores: ProveedorProducto[]
) {
  await client.query("DELETE FROM producto_proveedor WHERE id_producto = $1", [productId]);

  for (const item of proveedores) {
    if (!item?.id_proveedor) continue;
    await client.query(
      `
        INSERT INTO producto_proveedor (
          id_producto, id_proveedor, codigo_proveedor, 
          precio_lista_actual, costo_actual, fecha_ultima_actualizacion, ultima_importacion_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id_producto, id_proveedor) DO UPDATE
        SET 
          codigo_proveedor = EXCLUDED.codigo_proveedor,
          precio_lista_actual = EXCLUDED.precio_lista_actual,
          costo_actual = EXCLUDED.costo_actual,
          fecha_ultima_actualizacion = EXCLUDED.fecha_ultima_actualizacion,
          ultima_importacion_id = EXCLUDED.ultima_importacion_id
      `,
      [
        productId, 
        item.id_proveedor, 
        sanitizeNullableString(item.codigo_proveedor),
        item.precio_lista_actual || null,
        item.costo_actual || null,
        item.fecha_ultima_actualizacion || null,
        item.ultima_importacion_id || null
      ]
    );
  }
}

async function getProductoProveedores(id: string | number) {
  const proveedoresQuery = `
    SELECT
      id_proveedor,
      COALESCE(codigo_proveedor, '') AS codigo_proveedor,
      precio_lista_actual,
      costo_actual,
      fecha_ultima_actualizacion,
      ultima_importacion_id
    FROM producto_proveedor
    WHERE id_producto = $1
    ORDER BY id_proveedor
  `;

  const { rows } = await query(proveedoresQuery, [id]);
  return rows.length > 0
    ? (rows as ProveedorProducto[])
    : [{ id_proveedor: null, codigo_proveedor: "", precio_lista_actual: null, costo_actual: null, fecha_ultima_actualizacion: null, ultima_importacion_id: null }];
}

export async function getProductosListado(
  page: number = 1, 
  limit: number = 50,
  filters: {
    search?: string;
    searchSpecific?: string;
    categoria?: string;
    subcategoria?: string;
    marca?: string;
    proveedor?: string;
  } = {}
): Promise<{ data: ProductoListado[]; totalCount: number; totalPages: number }> {
  const params: any[] = [];
  let whereClauses = ["1=1"];

  if (filters.search) {
    params.push(`%${filters.search}%`);
    whereClauses.push(`(
      p.descripcion ILIKE $${params.length} OR 
      p.cod_unico::text ILIKE $${params.length} OR 
      pi.codigo_pieza::text ILIKE $${params.length} OR 
      p.palabra_clave::text ILIKE $${params.length} OR
      p.cod_barra::text ILIKE $${params.length} OR
      cr.codigo::text ILIKE $${params.length}
    )`);
  }

  if (filters.searchSpecific) {
    params.push(filters.searchSpecific);
    whereClauses.push(`(
      p.cod_unico::text = $${params.length} OR 
      pi.codigo_pieza::text = $${params.length} OR
      p.cod_barra::text = $${params.length} OR
      cr.codigo::text = $${params.length}
    )`);
  }

  if (filters.categoria) {
    params.push(filters.categoria);
    whereClauses.push(`c.id = $${params.length}`);
  }

  if (filters.subcategoria) {
    params.push(filters.subcategoria);
    whereClauses.push(`s.id = $${params.length}`);
  }

  if (filters.marca) {
    params.push(filters.marca);
    whereClauses.push(`m.id = $${params.length}`);
  }

  if (filters.proveedor) {
    params.push(filters.proveedor);
    whereClauses.push(`prv.id = $${params.length}`);
  }

  const sql = `
    SELECT 
      p.id,
      COALESCE(p.cod_unico, '') AS cod_unico,
      p.descripcion,
      p.cod_barra,
      p.stock,
      p.imagen_url,
      pi.id AS id_pieza,
      pi.codigo_pieza,
      pi.descripcion AS pieza_descripcion,
      COALESCE(pi.imagen_medida_url, '') AS pieza_medida_url,
      m.id AS id_marca,
      m.descripcion AS marca,
      c.id AS id_categoria,
      c.descripcion AS categoria,
      s.id AS id_subcategoria,
      s.descripcion AS subcategoria,
      p.id_ubicacion,
      u.descripcion AS ubicacion,
      p.usa_numero_serie,
      p.palabra_clave,
      STRING_AGG(DISTINCT prv.descripcion, ', ') AS proveedor,
      STRING_AGG(DISTINCT NULLIF(TRIM(pp.codigo_proveedor), ''), ', ') AS codigo_proveedor,
      COALESCE(
        JSONB_AGG(DISTINCT JSONB_BUILD_OBJECT(
          'proveedor', COALESCE(prv.descripcion, ''),
          'codigo_proveedor', COALESCE(NULLIF(TRIM(pp.codigo_proveedor), ''), '')
        )) FILTER (WHERE prv.descripcion IS NOT NULL),
        '[]'::jsonb
      ) AS proveedores_detalle,
      COALESCE(
        ARRAY_AGG(DISTINCT cr.codigo) FILTER (WHERE pcr.tipo = 'ORIGINAL' AND cr.codigo IS NOT NULL),
        ARRAY[]::varchar[]
      ) AS originales,
      COALESCE(
        ARRAY_AGG(DISTINCT cr.codigo) FILTER (WHERE pcr.tipo = 'EQUIVALENTE' AND cr.codigo IS NOT NULL),
        ARRAY[]::varchar[]
      ) AS equivalentes,
      COALESCE(
        ARRAY_AGG(DISTINCT cr.codigo) FILTER (WHERE pcr.tipo = 'SUSTITUTO' AND cr.codigo IS NOT NULL),
        ARRAY[]::varchar[]
      ) AS sustitutos
    FROM productos p
    LEFT JOIN pieza pi ON pi.id = p.id_pieza
    LEFT JOIN marcas m ON m.id = p.id_marca
    LEFT JOIN subcategoria s ON s.id = p.id_subcategoria
    LEFT JOIN categoria c ON c.id = s.id_categoria
    LEFT JOIN producto_proveedor pp ON pp.id_producto = p.id
    LEFT JOIN proveedores prv ON prv.id = pp.id_proveedor
    LEFT JOIN ubicaciones u ON u.id = p.id_ubicacion
    LEFT JOIN pieza_codigo_referencia pcr ON pcr.id_pieza = pi.id
    LEFT JOIN codigo_referencia cr ON cr.id = pcr.id_codigo_referencia
    WHERE ${whereClauses.join(" AND ")}
    GROUP BY
      p.id,
      p.cod_unico,
      p.descripcion,
      p.cod_barra,
      p.stock,
      pi.codigo_pieza,
      pi.descripcion,
      pi.id,
      pi.imagen_medida_url,
      m.descripcion,
      m.id,
      c.descripcion,
      c.id,
      s.descripcion,
      s.id,
      p.id_pieza,
      p.id_marca,
      p.id_subcategoria,
      p.id_ubicacion,
      u.descripcion,
      p.imagen_url,
      p.usa_numero_serie,
      p.palabra_clave
    ORDER BY p.id DESC
  `;

  return await paginateQuery<ProductoListado>("productos", sql, page, limit, params);
}

export async function getProductosParaExportar(filters: {
  search?: string;
  searchSpecific?: string;
  categoria?: string;
  subcategoria?: string;
  marca?: string;
  proveedor?: string;
} = {}): Promise<any[]> {
  const params: any[] = [];
  let whereClauses = ["1=1"];

  if (filters.search) {
    params.push(`%${filters.search}%`);
    whereClauses.push(`(
      p.descripcion ILIKE $${params.length} OR 
      p.cod_unico::text ILIKE $${params.length} OR 
      pi.codigo_pieza::text ILIKE $${params.length} OR 
      p.palabra_clave::text ILIKE $${params.length} OR
      p.cod_barra::text ILIKE $${params.length} OR
      cr.codigo::text ILIKE $${params.length}
    )`);
  }

  if (filters.searchSpecific) {
    params.push(filters.searchSpecific);
    whereClauses.push(`(
      p.cod_unico::text = $${params.length} OR 
      pi.codigo_pieza::text = $${params.length} OR
      p.cod_barra::text = $${params.length} OR
      cr.codigo::text = $${params.length}
    )`);
  }

  if (filters.categoria) {
    params.push(filters.categoria);
    whereClauses.push(`c.id = $${params.length}`);
  }

  if (filters.subcategoria) {
    params.push(filters.subcategoria);
    whereClauses.push(`s.id = $${params.length}`);
  }

  if (filters.marca) {
    params.push(filters.marca);
    whereClauses.push(`m.id = $${params.length}`);
  }

  if (filters.proveedor) {
    params.push(filters.proveedor);
    whereClauses.push(`prv.id = $${params.length}`);
  }

  const sql = `
    SELECT 
      p.cod_unico AS "Código Único",
      p.descripcion AS "Descripción",
      p.cod_barra AS "Código de Barras",
      p.stock AS "Stock",
      m.descripcion AS "Marca",
      c.descripcion AS "Categoría",
      s.descripcion AS "Subcategoría",
      u.descripcion AS "Ubicación",
      p.palabra_clave AS "Palabras Clave",
      
      -- APARTADO PIEZA
      pi.codigo_pieza AS "Nro Pieza",
      COALESCE(STRING_AGG(DISTINCT cr.codigo, ', ') FILTER (WHERE pcr.tipo = 'ORIGINAL'), '') AS "Códigos Originales",
      COALESCE(STRING_AGG(DISTINCT cr.codigo, ', ') FILTER (WHERE pcr.tipo = 'EQUIVALENTE'), '') AS "Códigos Equivalentes",
      COALESCE(STRING_AGG(DISTINCT cr.codigo, ', ') FILTER (WHERE pcr.tipo = 'SUSTITUTO'), '') AS "Códigos Sustitutos",
      
      -- APARTADO PRECIOS (Formateado como string para compatibilidad total)
      COALESCE(
        STRING_AGG(DISTINCT tp.descripcion || ': $' || pp_p.precio || ' (' || COALESCE(pp_p.porcentaje_ganancia, 0) || '%)', ' | '), 
        ''
      ) AS "Precios y Márgenes",
      
      -- APARTADO PROVEEDORES
      COALESCE(
        (SELECT prv2.descripcion 
         FROM producto_proveedor pp2 
         JOIN proveedores prv2 ON prv2.id = pp2.id_proveedor 
         WHERE pp2.id_producto = p.id 
         ORDER BY pp2.id_proveedor ASC 
         LIMIT 1), 
        ''
      ) AS "Proveedor",
      COALESCE(
        (SELECT pp2.codigo_proveedor 
         FROM producto_proveedor pp2 
         WHERE pp2.id_producto = p.id 
         ORDER BY pp2.id_proveedor ASC 
         LIMIT 1), 
        ''
      ) AS "Código de Proveedor",
      COALESCE(
        (SELECT pp2.precio_lista_actual::text 
         FROM producto_proveedor pp2 
         WHERE pp2.id_producto = p.id 
         ORDER BY pp2.id_proveedor ASC 
         LIMIT 1), 
        '0'
      ) AS "Precio Lista",
      
      -- APARTADO SERIES
      CASE WHEN p.usa_numero_serie THEN 'SÍ' ELSE 'NO' END AS "Usa Serie",
      COALESCE(STRING_AGG(DISTINCT ps.numero_serie, ', ') FILTER (WHERE ps.estado = 'DISPONIBLE'), '') AS "Números de Serie Disponibles"

    FROM productos p
    LEFT JOIN pieza pi ON pi.id = p.id_pieza
    LEFT JOIN marcas m ON m.id = p.id_marca
    LEFT JOIN subcategoria s ON s.id = p.id_subcategoria
    LEFT JOIN categoria c ON c.id = s.id_categoria
    LEFT JOIN ubicaciones u ON u.id = p.id_ubicacion
    LEFT JOIN producto_proveedor pp_prov ON pp_prov.id_producto = p.id
    LEFT JOIN proveedores prv ON prv.id = pp_prov.id_proveedor
    LEFT JOIN producto_precio pp_p ON pp_p.id_producto = p.id
    LEFT JOIN tipo_precio tp ON tp.id = pp_p.id_tipo_precio
    LEFT JOIN pieza_codigo_referencia pcr ON pcr.id_pieza = pi.id
    LEFT JOIN codigo_referencia cr ON cr.id = pcr.id_codigo_referencia
    LEFT JOIN producto_serie ps ON ps.id_producto = p.id AND ps.estado = 'DISPONIBLE'
    
    WHERE ${whereClauses.join(" AND ")}
    GROUP BY p.id, pi.id, m.id, c.id, s.id, u.id
    ORDER BY p.id DESC
  `;

  const { rows } = await query(sql, params);
  return rows;
}

export async function getProductoById(id: string | number): Promise<Producto | null> {
  const productQuery = `
    SELECT
      p.id,
      COALESCE(p.cod_unico, '') AS cod_unico,
      p.descripcion,
      COALESCE(p.cod_barra, '') AS cod_barra,
      p.stock,
      p.id_pieza,
      p.id_subcategoria,
      p.id_marca,
      p.imagen_url,
      s.id_categoria,
      pi.codigo_pieza,
      pi.descripcion AS pieza_descripcion,
      pi.imagen_medida_url AS pieza_medida_url,
      ps.id AS pieza_id_subcategoria,
      ps.descripcion AS pieza_subcategoria,
      pc.id AS pieza_id_categoria,
      pc.descripcion AS pieza_categoria,
      pi.medida AS pieza_medida,
      p.id_ubicacion,
      u.descripcion AS ubicacion,
      p.usa_numero_serie,
      p.palabra_clave,
      COALESCE(
        ARRAY_AGG(DISTINCT cr.codigo) FILTER (WHERE pcr.tipo = 'ORIGINAL' AND cr.codigo IS NOT NULL),
        ARRAY[]::varchar[]
      ) AS originales,
      COALESCE(
        ARRAY_AGG(DISTINCT cr.codigo) FILTER (WHERE pcr.tipo = 'EQUIVALENTE' AND cr.codigo IS NOT NULL),
        ARRAY[]::varchar[]
      ) AS equivalentes,
      COALESCE(
        ARRAY_AGG(DISTINCT cr.codigo) FILTER (WHERE pcr.tipo = 'SUSTITUTO' AND cr.codigo IS NOT NULL),
        ARRAY[]::varchar[]
      ) AS sustitutos
    FROM productos p
    LEFT JOIN subcategoria s ON s.id = p.id_subcategoria
    LEFT JOIN pieza pi ON pi.id = p.id_pieza
    LEFT JOIN subcategoria ps ON ps.id = pi.id_subcategoria
    LEFT JOIN categoria pc ON pc.id = ps.id_categoria
    LEFT JOIN ubicaciones u ON u.id = p.id_ubicacion
    LEFT JOIN pieza_codigo_referencia pcr ON pcr.id_pieza = pi.id
    LEFT JOIN codigo_referencia cr ON cr.id = pcr.id_codigo_referencia
    WHERE p.id = $1
    GROUP BY
      p.id,
      p.cod_unico,
      p.descripcion,
      p.cod_barra,
      p.stock,
      p.id_pieza,
      p.id_subcategoria,
      p.id_marca,
      p.imagen_url,
      s.id_categoria,
      pi.codigo_pieza,
      pi.descripcion,
      pi.imagen_medida_url,
      ps.id,
      ps.descripcion,
      pc.id,
      pc.descripcion,
      pi.medida,
      p.id_ubicacion,
      u.descripcion,
      p.usa_numero_serie,
      p.palabra_clave
    `;

  const [productRes, proveedores, precios] = await Promise.all([
    query(productQuery, [id]),
    getProductoProveedores(id),
    getProductoPrecios(id),
  ]);


  if (productRes.rows.length === 0) return null;

  const row = productRes.rows[0] as Producto & {
    pieza_id_categoria?: number;
    pieza_categoria?: string;
    pieza_id_subcategoria?: number;
    pieza_subcategoria?: string;
    codigo_pieza?: string;
    pieza_descripcion?: string;
    pieza_medida_url?: string;
    pieza_medida?: string;
    sustitutos?: string[];
  };

  const product: Producto = {
    ...row,
    proveedores,
    originales: (row.originales as string[]) ?? [],
    equivalentes: (row.equivalentes as string[]) ?? [],
    sustitutos: (row.sustitutos as string[]) ?? [],
    precios: precios as any[],

    medida: row.pieza_medida ?? "",
    id_ubicacion: row.id_ubicacion,
    ubicacion: row.ubicacion,
  };

  if (product.id_pieza) {
    product.pieza = {
      id: product.id_pieza,
      codigo_pieza: row.codigo_pieza ?? "",
      descripcion: row.pieza_descripcion ?? "",
      imagen_medida_url: row.pieza_medida_url ?? "",
      id_categoria: row.pieza_id_categoria ?? 0,
      categoria: row.pieza_categoria ?? "",
      id_subcategoria: row.pieza_id_subcategoria ?? 0,
      subcategoria: row.pieza_subcategoria ?? "",
      originales: product.originales ?? [],
      equivalentes: product.equivalentes ?? [],
      sustitutos: product.sustitutos ?? [],
      medida: product.medida ?? "",
    };
  }

  return product;
}

/**
 * Verifica si un código de barra ya está en uso.
 */
export async function isBarcodeDuplicate(barcode: string, excludeId?: string | number): Promise<boolean> {
  if (!barcode) return false;
  
  let sql = "SELECT p.id FROM productos p WHERE p.cod_barra = $1";
  const params: any[] = [barcode];

  if (excludeId) {
    sql += " AND p.id != $2";
    params.push(excludeId);
  }

  const { rows } = await query(sql, params);
  return rows.length > 0;
}

/**
 * Genera un código de barra interno de 13 dígitos empezando por 200.
 */
export async function generateUniqueBarcode(): Promise<string> {
  const prefix = "200";
  let isUnique = false;
  let barcode = "";
  let attempts = 0;

  while (!isUnique && attempts < 10) {
    const randomSuffix = Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');
    barcode = prefix + randomSuffix;
    
    const exists = await isBarcodeDuplicate(barcode);
    if (!exists) {
      isUnique = true;
    }
    attempts++;
  }

  return barcode;
}

export async function createProducto(input: ProductoInput) {
  return await withTransaction(async (client) => {
    const payload = sanitizeProductoInput(input);
    
    // Validamos duplicado
    if (payload.cod_barra && await isBarcodeDuplicate(payload.cod_barra)) {
      const err = new Error(`El código de barra ${payload.cod_barra} ya está en uso por otro producto`);
      (err as any).status = 400;
      throw err;
    }

    const productResult = await client.query(
      `
        INSERT INTO productos (
          cod_unico,
          descripcion,
          cod_barra,
          stock,
          id_pieza,
          id_subcategoria,
          id_marca,
          id_ubicacion,
          imagen_url,
          usa_numero_serie,
          palabra_clave
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
      `,
      [
        payload.cod_unico,
        payload.descripcion,
        payload.cod_barra,
        payload.stock,
        payload.id_pieza,
        payload.id_subcategoria,
        payload.id_marca,
        payload.id_ubicacion,
        payload.imagen_url,
        payload.usa_numero_serie,
        payload.palabra_clave,
      ]
    );

    const newProduct = productResult.rows[0];
    await Promise.all([
      syncProductoProveedores(client, newProduct.id, payload.proveedores),
      syncProductoPrecios(client, newProduct.id, payload.precios),
    ]);


    return newProduct;
  });
}

export async function updateProducto(id: string | number, input: ProductoInput) {
  // Obtenemos el producto ANTES para saber si la imagen cambió
  const existingProduct = await getProductoById(id);
  const oldImageUrl = existingProduct?.imagen_url;

  const result = await withTransaction(async (client) => {
    const payload = sanitizeProductoInput(input);

    // Validamos duplicado si se cambió el código
    if (payload.cod_barra && await isBarcodeDuplicate(payload.cod_barra, id)) {
      const err = new Error(`El código de barra ${payload.cod_barra} ya está en uso por otro producto`);
      (err as any).status = 400;
      throw err;
    }

    const result = await client.query(
      `
        UPDATE productos
        SET
          cod_unico = $1,
          descripcion = $2,
          cod_barra = $3,
          stock = $4,
          id_pieza = $5,
          id_subcategoria = $6,
          id_marca = $7,
          id_ubicacion = $8,
          imagen_url = $9,
          usa_numero_serie = $10,
          palabra_clave = $11
        WHERE id = $12
        RETURNING *
      `,
      [
        payload.cod_unico,
        payload.descripcion,
        payload.cod_barra,
        payload.stock,
        payload.id_pieza,
        payload.id_subcategoria,
        payload.id_marca,
        payload.id_ubicacion,
        payload.imagen_url,
        payload.usa_numero_serie,
        payload.palabra_clave,
        id,
      ]
    );

    if (result.rowCount === 0) {
      const err = new Error("Producto no encontrado");
      (err as Error & { status?: number }).status = 404;
      throw err;
    }

    await Promise.all([
      syncProductoProveedores(client, id, payload.proveedores),
      syncProductoPrecios(client, id, payload.precios),
    ]);


    const updatedProduct = result.rows[0];

    return updatedProduct;
  });

  // Si la transacción fue exitosa y la imagen cambió, borramos la vieja
  const newImageUrl = input.imagen_url;
  if (oldImageUrl && oldImageUrl !== newImageUrl) {
    deleteFileFromStorage(oldImageUrl, "productos");
  }

  return result;
}

export async function deleteProducto(id: string | number) {
  return await withTransaction(async (client) => {
    // 1. Borrar movimientos de series vinculados
    await client.query(`
      DELETE FROM producto_serie_movimiento 
      WHERE id_producto_serie IN (SELECT id FROM producto_serie WHERE id_producto = $1)
    `, [id]);

    // 2. Borrar las series del producto
    await client.query("DELETE FROM producto_serie WHERE id_producto = $1", [id]);

    // 3. Borrar detalles de operaciones donde aparezca el producto
    await client.query("DELETE FROM operacion_detalle WHERE id_producto = $1", [id]);

    // 4. Borrar asociaciones con proveedores
    await client.query("DELETE FROM producto_proveedor WHERE id_producto = $1", [id]);

    // 5. Finalmente borrar el producto
    const result = await client.query("DELETE FROM productos WHERE id = $1 RETURNING *", [id]);

    if (result.rowCount === 0) {
      const err = new Error("Producto no encontrado");
      (err as Error & { status?: number }).status = 404;
      throw err;
    }

    const deletedProduct = result.rows[0];

    // Limpieza de almacenamiento
    if (deletedProduct.imagen_url) {
      deleteFileFromStorage(deletedProduct.imagen_url, "productos");
    }

    return deletedProduct;
  });
}

export async function getAvailableSerialsByProduct(idProducto: string | number): Promise<string[]> {
  const { rows } = await query(
    `SELECT numero_serie FROM producto_serie WHERE id_producto = $1 AND estado = 'DISPONIBLE' ORDER BY created_at ASC`,
    [idProducto]
  );
  return rows.map(r => r.numero_serie);
}

export async function importProductos(
  items: any[], 
  usuario: string, 
  archivo: string,
  mappings: Record<string, { csvHeader: string; updateExisting: boolean }>
) {
  return await withTransaction(async (client) => {
    // 1. Cargar metadatos para resolución rápida
    const [marcas, categorias, subcategorias, ubicaciones, piezas, proveedores] = await Promise.all([
      client.query("SELECT id, descripcion FROM marcas"),
      client.query("SELECT id, descripcion FROM categoria"),
      client.query("SELECT id, descripcion FROM subcategoria"),
      client.query("SELECT id, descripcion FROM ubicaciones"),
      client.query("SELECT id, codigo_pieza FROM pieza"),
      client.query("SELECT id, descripcion FROM proveedores"),
    ]);

    const normalize = (text: any) => {
      if (text === null || text === undefined) return '';
      return String(text).trim().toUpperCase();
    };

    const marcaMap = new Map<string, number>(marcas.rows.map(r => [normalize(r.descripcion), r.id]));
    const catMap = new Map<string, number>(categorias.rows.map(r => [normalize(r.descripcion), r.id]));
    const subMap = new Map<string, number>(subcategorias.rows.map(r => [normalize(r.descripcion), r.id]));
    const ubiMap = new Map<string, number>(ubicaciones.rows.map(r => [normalize(r.descripcion), r.id]));
    const piezaMap = new Map<string, number>(piezas.rows.map(r => [normalize(r.codigo_pieza), r.id]));
    const provMap = new Map<string, number>(proveedores.rows.map(r => [normalize(r.descripcion), r.id]));

    const defaultSubcatId = subMap.get(normalize("SIN SUBCATEGORIA"));
    const startTime = Date.now();

    // Arrays para Bulk Insert
    const v_cod_unico: string[] = [];
    const v_desc: string[] = [];
    const v_barra: (string | null)[] = [];
    const v_stock: number[] = [];
    const v_id_marca: (number | null)[] = [];
    const v_id_subcat: (number | null)[] = [];
    const v_id_ubi: (number | null)[] = [];
    const v_id_pieza: (number | null)[] = [];
    const v_palabra_clave: (string | null)[] = [];
    
    // Para relación proveedores
    const supplierLinks: { sku: string; provName: string; codProv: string | null; listPrice: number | null }[] = [];

    const results = {
      imported: 0,
      updated: 0,
      ignored: 0,
      errors: [] as { row: number; error: string; cod_unico: string }[],
      updatedDetails: [] as { cod_unico: string; changes: any }[],
    };

    // 2. Preparar los datos
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const rowNum = i + 1;
        
        const sku = item[mappings.cod_unico?.csvHeader]?.toString().trim();
        if (!sku) {
            results.ignored++;
            continue;
        }

        try {
            // Limpieza de datos básica con protección de límites de la DB
            const rawDesc = (mappings.titulo?.csvHeader ? item[mappings.titulo.csvHeader] : null) || sku;
            const desc = rawDesc ? String(rawDesc).trim().substring(0, 150) : "";
            
            const rawBarra = mappings.cod_barra?.csvHeader ? item[mappings.cod_barra.csvHeader] : null;
            const barra = rawBarra ? String(rawBarra).trim().substring(0, 50) : null;
            
            const rawStock = mappings.stock?.csvHeader ? item[mappings.stock.csvHeader] : 0;
            const stockNum = parseFloat(rawStock?.toString().replace(',', '.') || '0') || 0;
            
            const idMarca = mappings.marca?.csvHeader ? marcaMap.get(normalize(item[mappings.marca.csvHeader])) || null : null;
            
            // La subcategoría es obligatoria en DB, si no existe usamos la primera o la mapeada
            let idSubcat = mappings.subcategoria?.csvHeader ? subMap.get(normalize(item[mappings.subcategoria.csvHeader])) : null;
            if (!idSubcat) {
              idSubcat = subMap.values().next().value || 1; 
            }

            const idUbi = mappings.ubicacion?.csvHeader ? ubiMap.get(normalize(item[mappings.ubicacion.csvHeader])) || null : null;
            const idPieza = mappings.codigo_pieza?.csvHeader ? piezaMap.get(normalize(item[mappings.codigo_pieza.csvHeader])) || null : null;
            const keyword = mappings.palabra_clave?.csvHeader ? item[mappings.palabra_clave.csvHeader]?.toString() : null;

            v_cod_unico.push(sku.substring(0, 50));
            v_desc.push(desc);
            v_barra.push(barra);
            v_stock.push(stockNum);
            v_id_marca.push(idMarca);
            v_id_subcat.push(idSubcat);
            v_id_ubi.push(idUbi);
            v_id_pieza.push(idPieza);
            v_palabra_clave.push(keyword);

            // Relación proveedor
            const provName = mappings.proveedor?.csvHeader ? item[mappings.proveedor.csvHeader] : null;
            if (provName) {
                const rawPrice = mappings.precio_lista?.csvHeader ? item[mappings.precio_lista.csvHeader] : null;
                const priceNum = rawPrice ? parseFloat(rawPrice.toString().replace(',', '.')) : null;

                supplierLinks.push({ 
                  sku, 
                  provName: provName.toString(), 
                  codProv: mappings.codigo_proveedor?.csvHeader ? item[mappings.codigo_proveedor.csvHeader]?.toString() : null,
                  listPrice: isNaN(priceNum as any) ? null : priceNum
                });
            }
        } catch (err: any) {
            results.errors.push({ row: rowNum, error: `Error procesando fila: ${err.message}`, cod_unico: sku });
        }
    }

    if (v_cod_unico.length === 0) return { ...results, durationMs: Date.now() - startTime };

    // 3. Ejecutar Bulk Upsert de Productos
    const upsertQuery = `
      WITH upserted AS (
        INSERT INTO productos (
          cod_unico, descripcion, cod_barra, stock, id_marca, id_subcategoria, id_ubicacion, id_pieza, palabra_clave
        )
        SELECT * FROM UNNEST(
            $1::text[], $2::text[], $3::text[], $4::numeric[], $5::int[], $6::int[], $7::int[], $8::int[], $9::text[]
        ) AS t(cod_unico, descripcion, cod_barra, stock, id_marca, id_subcategoria, id_ubicacion, id_pieza, palabra_clave)
        ON CONFLICT (cod_unico) DO UPDATE SET
          descripcion = CASE WHEN $10 THEN EXCLUDED.descripcion ELSE productos.descripcion END,
          cod_barra = CASE WHEN $11 THEN EXCLUDED.cod_barra ELSE productos.cod_barra END,
          stock = CASE WHEN $12 THEN EXCLUDED.stock ELSE productos.stock END,
          id_marca = CASE WHEN $13 THEN EXCLUDED.id_marca ELSE productos.id_marca END,
          id_subcategoria = CASE WHEN $14 THEN EXCLUDED.id_subcategoria ELSE productos.id_subcategoria END,
          id_ubicacion = CASE WHEN $15 THEN EXCLUDED.id_ubicacion ELSE productos.id_ubicacion END,
          id_pieza = CASE WHEN $16 THEN EXCLUDED.id_pieza ELSE productos.id_pieza END,
          palabra_clave = CASE WHEN $17 THEN EXCLUDED.palabra_clave ELSE productos.palabra_clave END
        RETURNING *
      )
      SELECT * FROM upserted;
    `;

    try {
      const upsertRes = await client.query(upsertQuery, [
          v_cod_unico, v_desc, v_barra, v_stock, v_id_marca, v_id_subcat, v_id_ubi, v_id_pieza, v_palabra_clave,
          (!!mappings.titulo?.csvHeader && (mappings.titulo?.updateExisting ?? true)),
          (!!mappings.cod_barra?.csvHeader && (mappings.cod_barra?.updateExisting ?? true)),
          (!!mappings.stock?.csvHeader && (mappings.stock?.updateExisting ?? true)),
          (!!mappings.marca?.csvHeader && (mappings.marca?.updateExisting ?? true)),
          (!!mappings.subcategoria?.csvHeader && (mappings.subcategoria?.updateExisting ?? true)),
          (!!mappings.ubicacion?.csvHeader && (mappings.ubicacion?.updateExisting ?? true)),
          (!!mappings.codigo_pieza?.csvHeader && (mappings.codigo_pieza?.updateExisting ?? true)),
          (!!mappings.palabra_clave?.csvHeader && (mappings.palabra_clave?.updateExisting ?? true))
      ]);

      const skuToIdMap = new Map<string, number>(upsertRes.rows.map(r => [r.cod_unico, r.id]));
      
      // Mapeo de campos para el reporte de cambios
      const mappedFields = Object.entries(mappings)
        .filter(([_, config]) => !!config.csvHeader && config.updateExisting)
        .map(([field, _]) => field);

      upsertRes.rows.forEach(r => {
          if (r.is_new) {
              results.imported++;
          } else {
              results.updated++;
              // Solo guardamos detalles de los actualizados
              if (results.updatedDetails.length < 500) { // Límite para no saturar memoria
                  const changes: Record<string, any> = {};
                  mappedFields.forEach(f => {
                      // Traducir nombres internos a legibles si es necesario, o usar los originales
                      changes[f] = r[f];
                  });
                  results.updatedDetails.push({
                      cod_unico: r.cod_unico,
                      changes
                  });
              }
          }
      });

      // 4. Bulk Upsert de Proveedores (si corresponde)
      if (supplierLinks.length > 0 && mappings.proveedor?.updateExisting !== false) {
          const v_prod_id: number[] = [];
          const v_prov_id: number[] = [];
          const v_cod_prov: (string | null)[] = [];
          const v_price_lista: (number | null)[] = [];

          supplierLinks.forEach(link => {
              const prodId = skuToIdMap.get(link.sku);
              const provId = provMap.get(normalize(link.provName));
              if (prodId && provId) {
                  v_prod_id.push(prodId);
                  v_prov_id.push(provId);
                  v_cod_prov.push(link.codProv);
                  v_price_lista.push(link.listPrice);
              }
          });

          if (v_prod_id.length > 0) {
              const codProvShouldUpdate = mappings.codigo_proveedor?.updateExisting ?? true;
              const priceShouldUpdate = mappings.precio_lista?.updateExisting ?? true;
              
              await client.query(`
                  INSERT INTO producto_proveedor (id_producto, id_proveedor, codigo_proveedor, precio_lista_actual, fecha_ultima_actualizacion)
                  SELECT 
                      t.id_producto, t.id_proveedor, t.codigo_proveedor, t.precio_lista_actual,
                      CASE WHEN t.precio_lista_actual IS NOT NULL THEN CURRENT_TIMESTAMP ELSE NULL END
                  FROM UNNEST($1::int[], $2::int[], $3::text[], $4::numeric[])
                  AS t(id_producto, id_proveedor, codigo_proveedor, precio_lista_actual)
                  ON CONFLICT (id_producto, id_proveedor) DO UPDATE SET
                      codigo_proveedor = CASE WHEN $5 THEN EXCLUDED.codigo_proveedor ELSE producto_proveedor.codigo_proveedor END,
                      precio_lista_actual = CASE WHEN $6 AND EXCLUDED.precio_lista_actual IS NOT NULL THEN EXCLUDED.precio_lista_actual ELSE producto_proveedor.precio_lista_actual END,
                      fecha_ultima_actualizacion = CASE WHEN $6 AND EXCLUDED.precio_lista_actual IS NOT NULL THEN CURRENT_TIMESTAMP ELSE producto_proveedor.fecha_ultima_actualizacion END
              `, [v_prod_id, v_prov_id, v_cod_prov, v_price_lista, codProvShouldUpdate, priceShouldUpdate]);
          }
      }
    } catch (dbErr: any) {
      console.error("❌ Error en DB Bulk Upsert:", dbErr.message, dbErr.detail);
      throw new Error(`Error de base de datos: ${dbErr.message}${dbErr.detail ? ' - ' + dbErr.detail : ''}`);
    }

    // 5. Devolver resultados (log lo maneja el cliente consolidando todo)
    const durationMs = Date.now() - startTime;

    return { ...results, durationMs };
  });
}


export async function getImportacionesLogs(page: number = 1, limit: number = 20): Promise<{ data: any[]; totalCount: number; totalPages: number }> {
  const sql = `
    SELECT 
        id,
        fecha,
        usuario,
        archivo,
        items_importados,
        items_ignorados,
        cantidad_errores,
        detalles_errores,
        codigo_importacion,
        duracion_ms
    FROM log_importaciones
    ORDER BY fecha DESC
  `;
  
  return await paginateQuery<any>("log_importaciones", sql, page, limit);
}

export async function bulkUpdateBarcodes(updates: { id: number; cod_barra: string }[]) {
  return await withTransaction(async (client) => {
    for (const update of updates) {
      await client.query(
        "UPDATE productos SET cod_barra = $1 WHERE id = $2 AND (cod_barra IS NULL OR cod_barra = '')",
        [update.cod_barra, update.id]
      );
    }
  });
}
export async function clearProviderProducts(id_proveedor: number): Promise<void> {
  await withTransaction(async (client) => {
    await client.query("DELETE FROM producto_proveedor WHERE id_proveedor = $1", [id_proveedor]);
  });
}
