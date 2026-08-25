import { ProductForm } from "@/components/products/ProductForm";

export default function NuevoProductoPage() {
  return (
    <div className="min-h-screen bg-white p-4 dark:bg-black md:p-6">
      <div className="mx-auto w-full max-w-[1500px] bg-white dark:bg-black">
        <ProductForm />
      </div>
    </div>
  );
}
