import { ProductForm } from "@/components/products/ProductForm";
import { getProductMeta } from "@/lib/productos-meta";
import { getProductoById } from "@/lib/repos/productos";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditProductPage({ params }: Props) {
  const { id } = await params;

  const [product] = await Promise.all([getProductoById(id)]);

  if (!product) {
    throw new Error("Producto no encontrado");
  }

  return <ProductForm productId={id} initialProduct={product} />;
}
