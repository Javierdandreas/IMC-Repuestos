import Link from "next/link";
import { pool } from "@/utils/database";
import { ProductList } from "@/components/products/ProductList";
import { ProductoListado } from "@/interfaces/productos";
import { QueryResult } from "pg";

export const dynamic = "force-dynamic";

export default async function Home() {
  const query = `
    SELECT 
      p.id,
      COALESCE(p.cod_unico, '') AS cod_unico,
      p.descripcion,
      p.cod_barra,
      p.stock,
      m.descripcion AS marca,
      c.descripcion AS categoria,
      s.descripcion AS subcategoria,
      STRING_AGG(DISTINCT prv.descripcion, ', ') AS proveedor
    FROM productos p
    LEFT JOIN marcas m ON m.id = p.id_marca
    LEFT JOIN subcategoria s ON s.id = p.id_subcategoria
    LEFT JOIN categoria c ON c.id = s.id_categoria
    LEFT JOIN producto_proveedor pp ON pp.id_producto = p.id
    LEFT JOIN proveedores prv ON prv.id = pp.id_proveedor
    GROUP BY p.id, m.descripcion, c.descripcion, s.descripcion
    ORDER BY p.id DESC
  `;

  const { rows: products }: QueryResult<ProductoListado> = await pool.query(query);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Productos</h1>
          </div>
        </div>

        {products.length === 0 ? (
          <div className="rounded-lg bg-white p-10 text-center shadow">
            <h2 className="mb-2 text-xl font-semibold text-gray-800">Todavía no hay productos</h2>
            <p className="mb-6 text-gray-600">Creá el primero para empezar.</p>
          </div>
        ) : (
          <ProductList products={products} />
        )}
      </div>
    </div>
  );
}
