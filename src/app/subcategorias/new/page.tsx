import { SubcategoriaForm } from "@/components/subcategorias/SubcategoriaForm";
import { pool } from "@/utils/database";

async function getCategorias() {
  const { rows } = await pool.query(
    `SELECT id, descripcion FROM categoria ORDER BY descripcion ASC`
  );
  return rows;
}

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
