import type { DbClient } from "@/lib/db-utils";
import {
  calcularCostoConReglasProveedor,
  type ReglaCostoProveedor,
} from "@/lib/reglas-costo-proveedor";

/** Aplica descuentos consecutivos: 10% y luego 5% equivalen a un 14,5%. */
export function calcularCostoNetoProveedor(
  precioLista: number | null | undefined,
  descuentoGeneral = 0,
  descuentoMarca = 0,
  coeficienteMarca = 1,
): number | null {
  return calcularCostoConReglasProveedor(precioLista, [
    {
      nombre: "Coeficiente por marca",
      alcance: "GENERAL",
      id_marca: null,
      tipo_ajuste: "COEFICIENTE",
      valor: Number(coeficienteMarca) || 1,
      orden: 10,
      activo: true,
    },
    {
      nombre: "Descuento general",
      alcance: "GENERAL",
      id_marca: null,
      tipo_ajuste: "DESCUENTO_PORCENTUAL",
      valor: Number(descuentoGeneral) || 0,
      orden: 20,
      activo: true,
    },
    {
      nombre: "Descuento por marca",
      alcance: "GENERAL",
      id_marca: null,
      tipo_ajuste: "DESCUENTO_PORCENTUAL",
      valor: Number(descuentoMarca) || 0,
      orden: 30,
      activo: true,
    },
  ]);
}

type RecalcularCostosOptions = {
  idProveedor?: number;
  productIds?: number[];
};

/** Recalcula el costo neto vigente a partir de la lista y las reglas del proveedor. */
export async function recalcularCostosProveedorProductos(
  client: DbClient,
  { idProveedor, productIds }: RecalcularCostosOptions,
): Promise<number[]> {
  const ids = [...new Set((productIds ?? []).filter((id) => Number.isInteger(id) && id > 0))];
  if (!idProveedor && ids.length === 0) return [];

  const proveedores = await client.query(
    `
      SELECT
        pp.id_producto,
        pp.id_proveedor,
        pp.precio_lista_actual::float AS precio_lista_actual,
        pp.stock_texto_original,
        producto.id_marca
      FROM public.producto_proveedor pp
      INNER JOIN public.productos producto ON producto.id = pp.id_producto
      WHERE ($1::int IS NULL OR pp.id_proveedor = $1)
        AND ($2::int[] IS NULL OR pp.id_producto = ANY($2::int[]))
    `,
    [idProveedor ?? null, ids.length > 0 ? ids : null],
  );

  if (proveedores.rows.length === 0) return [];

  const providerIds = [...new Set(proveedores.rows.map((row) => Number(row.id_proveedor)))];
  const reglasResult = await client.query(
    `
      SELECT
        id,
        id_proveedor,
        nombre,
        alcance,
        id_marca,
        COALESCE(id_marcas, ARRAY[]::int[]) AS id_marcas,
        tipo_ajuste,
        valor::float AS valor,
        orden,
        activo,
        condicion_tipo,
        condicion_operador,
        condicion_valor
      FROM public.proveedor_regla_costo
      WHERE activo = true
        AND id_proveedor = ANY($1::int[])
      ORDER BY id_proveedor, orden, id
    `,
    [providerIds],
  );

  const reglasPorProveedor = new Map<number, ReglaCostoProveedor[]>();
  for (const regla of reglasResult.rows as ReglaCostoProveedor[]) {
    const rules = reglasPorProveedor.get(Number(regla.id_proveedor)) ?? [];
    rules.push(regla);
    reglasPorProveedor.set(Number(regla.id_proveedor), rules);
  }

  const cambios = proveedores.rows.map((row) => ({
    idProducto: Number(row.id_producto),
    idProveedor: Number(row.id_proveedor),
    costo: calcularCostoConReglasProveedor(
      row.precio_lista_actual,
      reglasPorProveedor.get(Number(row.id_proveedor)) ?? [],
      row.id_marca === null ? null : Number(row.id_marca),
      row.stock_texto_original,
    ),
  }));

  const result = await client.query(
    `
      WITH cambios AS (
        SELECT * FROM UNNEST($1::int[], $2::int[], $3::numeric[])
          AS valores(id_producto, id_proveedor, costo_actual)
      )
      UPDATE public.producto_proveedor proveedor
      SET costo_actual = cambios.costo_actual
      FROM cambios
      WHERE proveedor.id_producto = cambios.id_producto
        AND proveedor.id_proveedor = cambios.id_proveedor
      RETURNING proveedor.id_producto
    `,
    [
      cambios.map((cambio) => cambio.idProducto),
      cambios.map((cambio) => cambio.idProveedor),
      cambios.map((cambio) => cambio.costo),
    ],
  );

  return [...new Set(result.rows.map((row) => Number(row.id_producto)))];
}
