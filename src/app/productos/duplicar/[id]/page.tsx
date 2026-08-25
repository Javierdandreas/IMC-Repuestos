import { ProductForm } from "@/components/products/ProductForm";
import { getProductoById } from "@/lib/repos/productos";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export default async function DuplicarProductoPage({ params }: Props) {
  const { id } = await params;
  const product = await getProductoById(id);

  if (!product) notFound();

  return (
    <div className="min-h-screen bg-white p-4 dark:bg-black md:p-6">
      <div className="mx-auto w-full max-w-[1500px] bg-white dark:bg-black">
        <ProductForm initialProduct={product} />
      </div>
    </div>
  );
}
