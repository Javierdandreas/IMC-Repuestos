import { ProductForm } from "@/components/products/ProductForm";
import { getProductoById } from "@/lib/repos/productos";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditProductPage({ params }: Props) {
  const { id } = await params;

  const product = await getProductoById(id);

  if (!product) notFound();

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-white dark:bg-black">
      <div className="w-full bg-white dark:bg-black">
        <ProductForm productId={id} initialProduct={product} />
      </div>
    </div>
  );
}
