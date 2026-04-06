import { SubcategoriaForm } from "@/components/subcategorias/SubcategoriaForm";
import { getCategorias } from "@/lib/repos/catalogos";

export default async function NewSubcategoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ id_categoria?: string }>;
}) {
  const categorias = await getCategorias();
  const { id_categoria } = await searchParams;

  return (
    <SubcategoriaForm
      categorias={categorias}
      initialCategoriaId={id_categoria ?? ""}
    />
  );
}
