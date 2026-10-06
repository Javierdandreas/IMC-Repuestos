import { NextRequest, NextResponse } from "next/server";
import { requireApiReadSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";
import { query } from "@/lib/db-utils";
import { getUltimoItemProveedor } from "@/lib/repos/proveedor-importaciones";
import { calcularCostoConReglasProveedor, type ReglaCostoProveedor } from "@/lib/reglas-costo-proveedor";

export async function GET(request: NextRequest) {
  try {
    // 1. Validar sesión de lectura
    await requireApiReadSession(request);

    // 2. Obtener parámetros
    const { searchParams } = new URL(request.url);
    const id_proveedor = searchParams.get("id_proveedor");
    const codigo_proveedor = searchParams.get("codigo_proveedor");
    const idMarcaParam = Number(searchParams.get("id_marca"));
    const idMarca = Number.isInteger(idMarcaParam) && idMarcaParam > 0 ? idMarcaParam : null;

    if (!id_proveedor || !codigo_proveedor) {
      return NextResponse.json(
        { error: "id_proveedor y codigo_proveedor son requeridos" }, 
        { status: 400 }
      );
    }

    // 3. Consultar ítem
    const item = await getUltimoItemProveedor(
      Number(id_proveedor), 
      codigo_proveedor.trim()
    );

    if (!item) {
      return NextResponse.json(
        { message: "No se encontró información para este código y proveedor", data: null },
        { status: 404 }
      );
    }

    const reglas = await query<ReglaCostoProveedor>(
      `
        SELECT
          id, id_proveedor, nombre, alcance, id_marca,
          COALESCE(id_marcas, ARRAY[]::int[]) AS id_marcas,
          tipo_ajuste, valor::float AS valor, orden, activo,
          condicion_tipo, condicion_operador, condicion_valor
        FROM public.proveedor_regla_costo
        WHERE id_proveedor = $1 AND activo = true
        ORDER BY orden, id
      `,
      [Number(id_proveedor)],
    );
    const costo_neto = calcularCostoConReglasProveedor(
      item.precio_lista,
      reglas.rows,
      idMarca,
      item.stock_original ?? null,
    );

    return NextResponse.json({ ...item, costo_neto });

  } catch (error: any) {
    console.error("Error en GET /api/proveedores/ultimo-item:", error);
    return jsonError(error, "Error al consultar el último ítem del proveedor");
  }
}
