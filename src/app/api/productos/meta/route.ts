import { NextResponse } from "next/server";
import { pool } from "@/utils/database";

export async function GET() {
  try {
    const [marcas, categorias, subcategorias, proveedores, tipoTable] = await Promise.all([
      pool.query("SELECT id, descripcion FROM marcas ORDER BY descripcion"),
      pool.query("SELECT id, descripcion FROM categoria ORDER BY descripcion"),
      pool.query("SELECT id, id_categoria, descripcion FROM subcategoria ORDER BY descripcion"),
      pool.query("SELECT id, descripcion FROM proveedores ORDER BY descripcion"),
      pool.query("SELECT to_regclass('public.tipo_producto') AS table_name"),
    ]);

    let tipos = { rows: [] as { id: number; descripcion: string }[] };
    if (tipoTable.rows[0]?.table_name) {
      tipos = await pool.query("SELECT id, descripcion FROM tipo_producto ORDER BY descripcion");
    }

    return NextResponse.json({
      marcas: marcas.rows,
      categorias: categorias.rows,
      subcategorias: subcategorias.rows,
      proveedores: proveedores.rows,
      tipos: tipos.rows,
    });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
}
