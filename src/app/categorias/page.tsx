import { CategoriaTree } from "@/components/categorias/CategoriaTree";
import { getCategoriasTree } from "@/lib/repos/catalogos";

export default async function CategoriasPage() {
  const categorias = await getCategoriasTree();
  return <CategoriaTree categorias={categorias} />;
}
