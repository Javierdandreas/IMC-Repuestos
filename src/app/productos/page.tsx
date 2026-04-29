import { ProductList } from "@/components/products/ProductList";
import { getProductosListado } from "@/lib/repos/productos";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function ProductosPage({ searchParams }: Props) {
  const resolvedParams = await searchParams;
  const page = Number(resolvedParams?.page) || 1;

  const { data: products, totalPages, totalCount } = await getProductosListado(page, 50, {
    search: resolvedParams?.search as string,
    searchSpecific: resolvedParams?.searchSpecific as string,
    categoria: resolvedParams?.categoria as string,
    subcategoria: resolvedParams?.subcategoria as string,
    marca: resolvedParams?.marca as string,
    proveedor: resolvedParams?.proveedor as string,
  });

  return (
    <ProductList
      products={products}
      totalPages={totalPages}
      totalCount={totalCount}
      currentPage={page}
    />
  );
}