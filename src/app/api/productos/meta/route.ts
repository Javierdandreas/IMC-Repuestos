import { NextResponse } from "next/server";
import { getProductMeta } from "@/lib/productos-meta";
import { pool } from "@/utils/database";
import { requireApiSession } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  await requireApiSession(request);
  try {
    const [meta, tipoTable] = await Promise.all([
      getProductMeta(),
      pool.query("SELECT to_regclass('public.tipo_producto') AS table_name"),
    ]);

    let tipos = { rows: [] as { id: number; descripcion: string }[] };
    if (tipoTable.rows[0]?.table_name) {
      tipos = await pool.query("SELECT id, descripcion FROM tipo_producto ORDER BY descripcion");
    }

    return NextResponse.json({
      ...meta,
      tipos: tipos.rows,
    });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
}