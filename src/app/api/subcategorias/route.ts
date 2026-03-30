import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/utils/database";

export async function GET() {
  try {
    const { rows } = await pool.query(`
      SELECT
        s.id,
        s.descripcion,
        s.id_categoria,
        c.descripcion AS categoria
      FROM subcategoria s
      JOIN categoria c ON c.id = s.id_categoria
      ORDER BY c.descripcion ASC, s.descripcion ASC
    `);

    return NextResponse.json(rows);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { descripcion, id_categoria } = await request.json();

    const { rows } = await pool.query(
      `INSERT INTO subcategoria (descripcion, id_categoria) VALUES ($1, $2) RETURNING *`,
      [descripcion, id_categoria]
    );

    return NextResponse.json(rows[0]);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
}
