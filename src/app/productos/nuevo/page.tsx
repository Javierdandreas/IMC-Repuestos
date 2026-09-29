import { ProductForm } from "@/components/products/ProductForm";

export default function NuevoProductoPage() {
  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-white dark:bg-black">
      <div className="w-full bg-white dark:bg-black">
        <ProductForm />
      </div>
    </div>
  );
}
