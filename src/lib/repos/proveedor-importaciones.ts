import { query, withTransaction } from "@/lib/db-utils";
import {
  CreateImportacionInput,
  ProveedorImportacion,
  UltimoItemProveedor,
} from "@/interfaces/importaciones";

export async function createImportacion(input: CreateImportacionInput): Promise<ProveedorImportacion> {
  const { id_proveedor, nombre_archivo, items } = input;

  if (!id_proveedor) throw new Error("ID de proveedor es obligatorio");
  if (!items || items.length === 0) throw new Error("La lista de items no puede estar vacia");

  return await withTransaction(async (client) => {
    const headerResult = await client.query(
      `
        INSERT INTO public.proveedor_importacion (id_proveedor, nombre_archivo, total_items, estado)
        VALUES ($1, $2, $3, 'PROCESADA')
        RETURNING *
      `,
      [id_proveedor, nombre_archivo, items.length]
    );

    const importacion = headerResult.rows[0] as ProveedorImportacion;

    await client.query(
      `
        INSERT INTO public.proveedor_importacion_item (
          id_importacion, codigo_proveedor, precio_lista
        )
        SELECT $1, * FROM UNNEST(
          $2::text[], $3::numeric[]
        )
      `,
      [
        importacion.id,
        items.map((item) => item.codigo_proveedor),
        items.map((item) => item.precio_lista),
      ]
    );

    return importacion;
  });
}

export async function aplicarImportacionAlCatalogo(id_importacion: number) {
  return await withTransaction(async (client) => {
    const updateResult = await client.query(
      `
        UPDATE public.producto_proveedor pp
        SET
          precio_lista_actual = pii.precio_lista,
          fecha_ultima_actualizacion = NOW(),
          ultima_importacion_id = pii.id_importacion
        FROM public.proveedor_importacion_item pii
        INNER JOIN public.proveedor_importacion pi ON pi.id = pii.id_importacion
        WHERE pp.id_proveedor = pi.id_proveedor
          AND upper(trim(pp.codigo_proveedor)) = upper(trim(pii.codigo_proveedor))
          AND pi.id = $1
      `,
      [id_importacion]
    );

    await client.query(
      `UPDATE public.proveedor_importacion SET estado = 'APLICADA', updated_at = NOW() WHERE id = $1`,
      [id_importacion]
    );

    return { updatedCount: updateResult.rowCount || 0 };
  });
}

export async function getUltimoItemProveedor(
  id_proveedor: number,
  codigo_proveedor: string
): Promise<UltimoItemProveedor | null> {
  if (!id_proveedor || !codigo_proveedor) return null;

  const { rows } = await query(
    `SELECT * FROM public.fn_get_ultimo_item_proveedor($1, $2)`,
    [id_proveedor, codigo_proveedor]
  );

  if (rows.length === 0 || !rows[0].importacion_id) {
    return null;
  }

  return rows[0] as UltimoItemProveedor;
}

export async function getImportacionesByProveedor(id_proveedor: number) {
  const { rows } = await query(
    `SELECT * FROM public.proveedor_importacion WHERE id_proveedor = $1 ORDER BY created_at DESC`,
    [id_proveedor]
  );
  return rows as ProveedorImportacion[];
}

export async function getProveedorDiscounts(id_proveedor: number) {
  const { rows: header } = await query(
    `SELECT descuento_general FROM proveedores WHERE id = $1`,
    [id_proveedor]
  );

  const { rows: marcaDiscounts } = await query(
    `SELECT id_marca, descuento FROM proveedor_descuento_marca WHERE id_proveedor = $1`,
    [id_proveedor]
  );

  const discountsByBrand: Record<number, number> = {};
  marcaDiscounts.forEach((row) => {
    discountsByBrand[row.id_marca] = parseFloat(row.descuento);
  });

  return {
    descuentoGeneral: parseFloat(header[0]?.descuento_general || 0),
    descuentosPorMarca: discountsByBrand,
  };
}

export async function updateProveedorDiscounts(
  id_proveedor: number,
  descuentoGeneral: number,
  descuentosPorMarca: Record<number, number>
) {
  return await withTransaction(async (client) => {
    await client.query(
      `UPDATE proveedores SET descuento_general = $1 WHERE id = $2`,
      [descuentoGeneral, id_proveedor]
    );

    await client.query(
      `DELETE FROM proveedor_descuento_marca WHERE id_proveedor = $1`,
      [id_proveedor]
    );

    const ids = Object.keys(descuentosPorMarca).map(Number);
    const vals = Object.values(descuentosPorMarca).map(Number);

    if (ids.length > 0) {
      await client.query(
        `
          INSERT INTO proveedor_descuento_marca (id_proveedor, id_marca, descuento)
          SELECT $1, * FROM UNNEST($2::int[], $3::numeric[])
        `,
        [id_proveedor, ids, vals]
      );
    }

    return { success: true };
  });
}
