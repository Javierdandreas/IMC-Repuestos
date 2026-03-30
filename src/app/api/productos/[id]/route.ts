import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/utils/database";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const productQuery = `
      SELECT
        p.id,
        p.cod_unico,
        p.descripcion,
        COALESCE(p.cod_barra, '') AS cod_barra,
        p.stock,
        p.id_subcategoria,
        p.id_marca,
        s.id_categoria
      FROM productos p
      LEFT JOIN subcategoria s ON s.id = p.id_subcategoria
      WHERE p.id = $1
    `;

    const proveedoresQuery = `
      SELECT
        id_proveedor,
        COALESCE(codigo_proveedor, '') AS codigo_proveedor
      FROM producto_proveedor
      WHERE id_producto = $1
      ORDER BY id_proveedor
    `;

    const [productRes, proveedoresRes] = await Promise.all([
      pool.query(productQuery, [id]),
      pool.query(proveedoresQuery, [id]),
    ]);

    if (productRes.rows.length === 0) {
      return NextResponse.json({ message: "Producto no encontrado" }, { status: 404 });
    }

    const product = productRes.rows[0];
    product.proveedores =
      proveedoresRes.rows.length > 0
        ? proveedoresRes.rows
        : [{ id_proveedor: null, codigo_proveedor: "" }];

    return NextResponse.json(product);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const client = await pool.connect();

  try {
    const { id } = await params;
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

    const updateQuery = `
      UPDATE productos
      SET
        cod_unico = $1,
        descripcion = $2,
        cod_barra = $3,
        stock = $4,
        id_subcategoria = $5,
        id_marca = $6
      WHERE id = $7
      RETURNING *
    `;

    const values = [
      cod_unico,
      descripcion,
      cod_barra || null,
      Number(stock) || 0,
      id_subcategoria,
      id_marca || null,
      id,
    ];

    const result = await client.query(updateQuery, values);

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ message: "Producto no encontrado" }, { status: 404 });
    }

    await client.query("DELETE FROM producto_proveedor WHERE id_producto = $1", [id]);

    for (const item of proveedores) {
      if (!item?.id_proveedor) continue;

      await client.query(
        `
        INSERT INTO producto_proveedor (id_producto, id_proveedor, codigo_proveedor)
        VALUES ($1, $2, $3)
        ON CONFLICT (id_producto, id_proveedor) DO UPDATE
        SET codigo_proveedor = EXCLUDED.codigo_proveedor
        `,
        [id, item.id_proveedor, item.codigo_proveedor || null]
      );
    }

    await client.query("COMMIT");
    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    await client.query("ROLLBACK");
    return NextResponse.json({ message: error.message }, { status: 400 });
  } finally {
    client.release();
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const client = await pool.connect();

  try {
    const { id } = await params;

    await client.query("BEGIN");
    await client.query("DELETE FROM producto_proveedor WHERE id_producto = $1", [id]);

    const result = await client.query("DELETE FROM productos WHERE id = $1 RETURNING *", [id]);

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ message: "Producto no encontrado" }, { status: 404 });
    }

    await client.query("COMMIT");
    return NextResponse.json({ message: "Producto eliminado correctamente" });
  } catch (error: any) {
    await client.query("ROLLBACK");
    return NextResponse.json({ message: error.message }, { status: 400 });
  } finally {
    client.release();
  }
}
