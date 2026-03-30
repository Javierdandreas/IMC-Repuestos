import Link from "next/link";

export const Navbar = () => {
  return (
    <nav className="bg-gray-800 p-6 text-white">
      <div className="container mx-auto flex items-center justify-between">
        <Link href="/" className="flex cursor-pointer items-center">
          <span className="font-bold">IMC Productos</span>
        </Link>

        <Link
          href="/productos/new"
          className="rounded bg-blue-500 px-4 py-2 font-semibold text-white transition-colors duration-200 hover:bg-blue-600"
        >
          Nuevo producto
        </Link>
        <Link
          href="/marcas"
          className="rounded bg-blue-500 px-4 py-2 font-semibold text-white transition-colors duration-200 hover:bg-blue-600"
        >
          Nueva Marca
        </Link>
        <Link
          href="/proveedores"
          className="rounded bg-blue-500 px-4 py-2 font-semibold text-white transition-colors duration-200 hover:bg-blue-600"
        >
          Nuevo Proveedor
        </Link>
        <Link
          href="/categorias"
          className="rounded bg-blue-500 px-4 py-2 font-semibold text-white transition-colors duration-200 hover:bg-blue-600"
        >
          Nueva Categoria
        </Link>

      </div>
    </nav>
  );
};