import { MarcaList } from "@/components/marcas/MarcaList";
import { pool } from "@/utils/database";

async function getMarcas() {
  const { rows } = await pool.query(
    `SELECT id, descripcion FROM marcas ORDER BY descripcion ASC`
  );

  return rows;
}

export default async function MarcasPage() {
  const marcas = await getMarcas();

  return <MarcaList marcas={marcas} />;
}
