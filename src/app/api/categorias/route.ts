import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/utils/database";

export async function GET() {
  try {
    const { rows } = await pool.query(
      `SELECT id, descripcion FROM categoria ORDER BY descripcion ASC`
    );

    return NextResponse.json(rows);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { descripcion } = await request.json();

    const { rows } = await pool.query(
      `INSERT INTO categoria (descripcion) VALUES ($1) RETURNING *`,
      [descripcion]
    );

    return NextResponse.json(rows[0]);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
}
