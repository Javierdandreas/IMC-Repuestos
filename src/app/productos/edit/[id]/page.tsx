import { ProductForm } from "@/components/products/ProductForm";
import { getProductMeta } from "@/modules/productos/repos/productos-meta";
import { getProductoById } from "@/modules/productos/repos/productos";
import { MetadataProvider } from "@/context/MetadataContext";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditProductPage({ params }: Props) {
  const { id } = await params;

  const [product, meta] = await Promise.all([
    getProductoById(id),
    getProductMeta()
  ]);

  if (!product) {
    throw new Error("Producto no encontrado");
  }

  return (
    <MetadataProvider initialMeta={meta}>
      <ProductForm productId={id} initialProduct={product} />
    </MetadataProvider>
  );
}
