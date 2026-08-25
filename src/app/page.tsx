import { ProductList } from "@/components/products/ProductList";
import { getProductMeta } from "@/lib/productos-meta";
import { getProductosListado } from "@/lib/repos/productos";
import Link from "next/link";
import { getServerInternalUser } from "@/lib/auth";
import { canManageContent } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function Home({ searchParams }: Props) {
  const resolvedParams = await searchParams;
  const page = Number(resolvedParams?.page) || 1;

  const [{ data: products, totalPages, totalCount }, session] = await Promise.all([
    getProductosListado(page, 50, {
      search: resolvedParams?.search as string,
      searchSpecific: resolvedParams?.searchSpecific as string,
      categoria: resolvedParams?.categoria as string,
      subcategoria: resolvedParams?.subcategoria as string,
      marca: resolvedParams?.marca as string,
      proveedor: resolvedParams?.proveedor as string,
    }),
    getServerInternalUser()
  ]);
  const canManage = canManageContent(session?.rol);

  return (
    <ProductList
      products={products}
      totalPages={totalPages}
      totalCount={totalCount}
      currentPage={page}
    />
  );
}
