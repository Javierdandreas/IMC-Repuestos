import { NextResponse } from "next/server";
import { pool } from "@/utils/database";

export async function GET() {
  try {
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

    return NextResponse.json(grouped);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
}
