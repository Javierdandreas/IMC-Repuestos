import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/utils/database";

export async function GET() {
  try {
    const query = `
      SELECT
        p.id,
        p.cod_unico,
        p.descripcion,
        p.cod_barra,
        p.stock,
        m.descripcion AS marca,
        c.descripcion AS categoria,
        s.descripcion AS subcategoria
      FROM productos p
      LEFT JOIN marcas m ON m.id = p.id_marca
      LEFT JOIN subcategoria s ON s.id = p.id_subcategoria
      LEFT JOIN categoria c ON c.id = s.id_categoria
      ORDER BY p.id DESC
    `;

    const { rows } = await pool.query(query);
    return NextResponse.json(rows);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  const client = await pool.connect();

  try {
    const {
      cod_unico,
      descripcion,
      cod_barra,
      stock,
      id_subcategoria,
      id_marca,
      proveedores = [],
    } = await request.json();

    await client.query("BEGIN");

    const insertProductQuery = `
      INSERT INTO productos (
        cod_unico,
        descripcion,
        cod_barra,
        stock,
        id_subcategoria,
        id_marca
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const productValues = [
      cod_unico,
      descripcion,
      cod_barra || null,
      Number(stock) || 0,
      id_subcategoria,
      id_marca || null,
    ];

    const productResult = await client.query(insertProductQuery, productValues);
    const newProduct = productResult.rows[0];

    for (const item of proveedores) {
      if (!item?.id_proveedor) continue;

      await client.query(
        `
        INSERT INTO producto_proveedor (id_producto, id_proveedor, codigo_proveedor)
        VALUES ($1, $2, $3)
        ON CONFLICT (id_producto, id_proveedor) DO UPDATE
        SET codigo_proveedor = EXCLUDED.codigo_proveedor
        `,
        [newProduct.id, item.id_proveedor, item.codigo_proveedor || null]
      );
    }

    
    await client.query("COMMIT");
    return NextResponse.json(newProduct);
  } catch (error: any) {
    await client.query("ROLLBACK");
    return NextResponse.json({ message: error.message }, { status: 400 });
  } finally {
    client.release();
  }
}
