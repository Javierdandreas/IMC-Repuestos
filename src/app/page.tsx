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

  const [{ data: products, totalPages }, session] = await Promise.all([
    getProductosListado(page, 50),
    getServerInternalUser()
  ]);
  const canManage = canManageContent(session?.rol);

  return (
    <div className="bg-white dark:bg-black p-6">
      <ProductList
        products={products}
        totalPages={totalPages}
      />
    </div>
  );
}
