import { ProductList } from "@/components/products/ProductList";
import { getProductMeta } from "@/lib/productos-meta";
import { getProductosListado } from "@/lib/repos/productos";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [products, meta] = await Promise.all([getProductosListado(), getProductMeta()]);

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
              <h1 className="text-3xl font-bold text-gray-900">Productos</h1>
            </div>

            <Link
              href="/productos/new"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Crear producto
            </Link>
        </div>

        {products.length === 0 ? (
          <div className="rounded-lg bg-white p-10 text-center shadow">
            <h2 className="mb-2 text-xl font-semibold text-gray-800">Todavía no hay productos</h2>
            <p className="mb-6 text-gray-600">Creá el primero para empezar.</p>
          </div>
        ) : (
          <ProductList
            products={products}
            categorias={meta.categorias}
            subcategorias={meta.subcategorias}
            marcas={meta.marcas}
            proveedores={meta.proveedores}
          />
        )}
      </div>
    </div>
  );
}
