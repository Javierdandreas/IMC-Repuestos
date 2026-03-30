import { ProductForm } from "@/components/products/ProductForm";
import { getProductMeta } from "@/lib/productos-meta";

export default async function NewProductPage() {
  const meta = await getProductMeta();
  return <ProductForm meta={meta} />;
}
