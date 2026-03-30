import { CategoriaTree } from "@/components/categorias/CategoriaTree";
import { pool } from "@/utils/database";

async function getCategoriasTree() {
  const query = `
    SELECT
      c.id AS categoria_id,
      c.descripcion AS categoria_descripcion,
      s.id AS subcategoria_id,
      s.descripcion AS subcategoria_descripcion
    FROM categoria c
    LEFT JOIN subcategoria s ON s.id_categoria = c.id
    ORDER BY c.descripcion ASC, s.descripcion ASC
  `;

  const { rows } = await pool.query(query);

  const grouped = rows.reduce((acc: any[], row: any) => {
    let categoria = acc.find((item) => item.id === row.categoria_id);

    if (!categoria) {
      categoria = {
        id: row.categoria_id,
        descripcion: row.categoria_descripcion,
        subcategorias: [],
      };
      acc.push(categoria);
    }

    if (row.subcategoria_id) {
      categoria.subcategorias.push({
        id: row.subcategoria_id,
        descripcion: row.subcategoria_descripcion,
      });
    }

    return acc;
  }, []);

  return grouped;
}

export default async function CategoriasPage() {
  const categorias = await getCategoriasTree();

  return <CategoriaTree categorias={categorias} />;
}
