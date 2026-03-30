import { ProductForm } from "@/components/products/ProductForm";
import { Producto } from "@/interfaces/productos";
import { pool } from "@/utils/database";
import { QueryResult } from "pg";
import { getProductMeta } from "@/lib/productos-meta";

interface Props {
  params: Promise<{ id: string }>;
}

async function getProduct(id: string): Promise<Producto> {
  const query = `
    SELECT
      p.id,
      COALESCE(p.cod_unico, '') AS cod_unico,
      p.descripcion,
      COALESCE(p.cod_barra, '') AS cod_barra,
      p.stock,
      p.id_subcategoria,
      p.id_marca,
      s.id_categoria
    FROM productos p
    LEFT JOIN subcategoria s ON s.id = p.id_subcategoria
    WHERE p.id = $1
  `;

  const proveedoresQuery = `
    SELECT
      id_proveedor,
      COALESCE(codigo_proveedor, '') AS codigo_proveedor
    FROM producto_proveedor
    WHERE id_producto = $1
    ORDER BY id_proveedor
  `;

  const [productRes, proveedoresRes]: [QueryResult<Producto>, QueryResult<any>] = await Promise.all([
    pool.query(query, [id]),
    pool.query(proveedoresQuery, [id]),
  ]);

  if (productRes.rows.length === 0) {
    throw new Error("Producto no encontrado");
  }

  const product = productRes.rows[0];

  product.proveedores =
    proveedoresRes.rows.length > 0
      ? proveedoresRes.rows
      : [{ id_proveedor: null, codigo_proveedor: "" }];

  return product;
}

export default async function EditProductPage({ params }: Props) {
  const { id } = await params;

  const [product, meta] = await Promise.all([getProduct(id), getProductMeta()]);

  return <ProductForm productId={id} initialProduct={product} meta={meta} />;
}
