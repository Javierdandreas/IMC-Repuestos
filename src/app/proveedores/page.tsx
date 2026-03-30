import { ProveedorList } from "@/components/proveedores/ProveedorList";
import { pool } from "@/utils/database";

async function getProveedores() {
  const { rows } = await pool.query(
    `SELECT id, descripcion FROM proveedores ORDER BY descripcion ASC`
  );

  return rows;
}

export default async function ProveedoresPage() {
  const proveedores = await getProveedores();

  return <ProveedorList proveedores={proveedores} />;
}
