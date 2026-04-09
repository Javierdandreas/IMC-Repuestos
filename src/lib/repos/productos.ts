import { query, withTransaction, paginateQuery } from "@/lib/db-utils";
import type { Producto, ProductoListado, ProveedorProducto } from "@/interfaces/productos";
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
  };
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
        INSERT INTO producto_proveedor (id_producto, id_proveedor, codigo_proveedor)
        VALUES ($1, $2, $3)
        ON CONFLICT (id_producto, id_proveedor) DO UPDATE
        SET codigo_proveedor = EXCLUDED.codigo_proveedor
      `,
      [productId, item.id_proveedor, sanitizeNullableString(item.codigo_proveedor)]
    );
  }
}

async function getProductoProveedores(id: string | number) {
  const proveedoresQuery = `
    SELECT
      id_proveedor,
      COALESCE(codigo_proveedor, '') AS codigo_proveedor
    FROM producto_proveedor
    WHERE id_producto = $1
    ORDER BY id_proveedor
  `;

  const { rows } = await query(proveedoresQuery, [id]);
  return rows.length > 0
    ? (rows as ProveedorProducto[])
    : [{ id_proveedor: null, codigo_proveedor: "" }];
}

export async function getProductosListado(page: number = 1, limit: number = 50): Promise<{ data: ProductoListado[]; totalCount: number; totalPages: number }> {
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
      ) AS equivalentes
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
      p.imagen_url
    ORDER BY p.id DESC
  `;

  return await paginateQuery<ProductoListado>("productos", sql, page, limit);
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
      u.descripcion
    `;

  const [productRes, proveedores] = await Promise.all([
    query(productQuery, [id]),
    getProductoProveedores(id),
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
          imagen_url
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
      ]
    );

    const newProduct = productResult.rows[0];
    await syncProductoProveedores(client, newProduct.id, payload.proveedores);

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
          imagen_url = $9
        WHERE id = $10
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
        id,
      ]
    );

    if (result.rowCount === 0) {
      const err = new Error("Producto no encontrado");
      (err as Error & { status?: number }).status = 404;
      throw err;
    }

    await syncProductoProveedores(client, id, payload.proveedores);

    return result.rows[0];
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
    await client.query("DELETE FROM producto_proveedor WHERE id_producto = $1", [id]);
    const result = await client.query("DELETE FROM productos WHERE id = $1 RETURNING *", [id]);

    if (result.rowCount === 0) {
      const err = new Error("Producto no encontrado");
      (err as Error & { status?: number }).status = 404;
      throw err;
    }

    const deletedProduct = result.rows[0];

    // Limpieza de almacenamiento (opcional/segundo plano)
    if (deletedProduct.imagen_url) {
      deleteFileFromStorage(deletedProduct.imagen_url, "productos");
    }

    return deletedProduct;
  });
}
