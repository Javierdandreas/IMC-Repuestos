import Link from "next/link";
import { ProductoListado } from "@/interfaces/productos";

interface Props {
  products: ProductoListado[];
}

export function ProductList({ products }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Código único</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Descripción</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Marca</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Categoría</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Subcategoría</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Proveedor</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Stock</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {products.map((product) => (
            <tr key={product.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-sm text-gray-900">{product.cod_unico}</td>
              <td className="px-4 py-3 text-sm text-gray-900">{product.descripcion}</td>
              <td className="px-4 py-3 text-sm text-gray-700">{product.marca ?? "-"}</td>
              <td className="px-4 py-3 text-sm text-gray-700">{product.categoria ?? "-"}</td>
              <td className="px-4 py-3 text-sm text-gray-700">{product.subcategoria ?? "-"}</td>
              <td className="px-4 py-3 text-sm text-gray-700">{product.proveedor ?? "-"}</td>
              <td className="px-4 py-3 text-sm text-gray-700">{product.stock}</td>
              <td className="px-4 py-3 text-sm">
                <Link
                  href={`/productos/edit/${product.id}`}
                  className="rounded bg-blue-600 px-3 py-2 text-white hover:bg-blue-700"
                >
                  Editar
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
