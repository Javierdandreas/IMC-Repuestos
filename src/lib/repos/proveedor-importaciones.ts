import { query, withTransaction } from "@/lib/db-utils";
import { 
  CreateImportacionInput, 
  ProveedorImportacion, 
  UltimoItemProveedor 
} from "@/interfaces/importaciones";

/**
 * Crea una nueva importación de proveedor y guarda todos sus ítems de forma masiva.
 */
export async function createImportacion(input: CreateImportacionInput): Promise<ProveedorImportacion> {
  const { id_proveedor, nombre_archivo, items } = input;

  if (!id_proveedor) throw new Error("ID de proveedor es obligatorio");
  if (!items || items.length === 0) throw new Error("La lista de ítems no puede estar vacía");

  return await withTransaction(async (client) => {
    // 1. Insertar cabecera
    const headerResult = await client.query(
      `
        INSERT INTO public.proveedor_importacion (id_proveedor, nombre_archivo, total_items, estado)
        VALUES ($1, $2, $3, 'PROCESADA')
        RETURNING *
      `,
      [id_proveedor, nombre_archivo, items.length]
    );

    const importacion = headerResult.rows[0] as ProveedorImportacion;

    // 2. Insertar ítems masivamente (Bulk Insert)
    // Preparamos los arrays para UNNEST
    const v_codigo = items.map(i => i.codigo_proveedor);
    const v_precio = items.map(i => i.precio_lista);

    await client.query(
      `
        INSERT INTO public.proveedor_importacion_item (
          id_importacion, codigo_proveedor, precio_lista
        )
        SELECT $1, * FROM UNNEST(
          $2::text[], $3::numeric[]
        )
      `,
      [importacion.id, v_codigo, v_precio]
    );

    return importacion;
  });
}

/**
 * Aplica masivamente los precios de una importación al catálogo de productos.
 * Cruza por id_proveedor y codigo_proveedor.
 */
export async function aplicarImportacionAlCatalogo(id_importacion: number) {
  return await withTransaction(async (client) => {
    // 1. Actualizar producto_proveedor vinculados
    const updateResult = await client.query(
      `
        UPDATE public.producto_proveedor pp
        SET 
          precio_lista_actual = pii.precio_lista,
          fecha_ultima_actualizacion = NOW(),
          ultima_importacion_id = pii.id_importacion
        FROM public.proveedor_importacion_item pii
        JOIN public.proveedor_importacion pi ON pi.id = pii.id_importacion
        WHERE pp.id_proveedor = pi.id_proveedor
          AND upper(trim(pp.codigo_proveedor)) = upper(trim(pii.codigo_proveedor))
          AND pi.id = $1
      `,
      [id_importacion]
    );

    // 2. Marcar importación como APLICADA
    await client.query(
      `UPDATE public.proveedor_importacion SET estado = 'APLICADA', updated_at = NOW() WHERE id = $1`,
      [id_importacion]
    );

    return { updatedCount: updateResult.rowCount || 0 };
  });
}

/**
 * Obtiene el último ítem importado para un proveedor y código específicos.
 * Utiliza la función SQL public.fn_get_ultimo_item_proveedor.
 */
export async function getUltimoItemProveedor(
  id_proveedor: number, 
  codigo_proveedor: string
): Promise<UltimoItemProveedor | null> {
  if (!id_proveedor || !codigo_proveedor) return null;

  const { rows } = await query(
    `SELECT * FROM public.fn_get_ultimo_item_proveedor($1, $2)`,
    [id_proveedor, codigo_proveedor]
  );

  // La función devuelve una fila vacía o con NULLs si no encuentra nada.
  // Validamos si el importacion_id existe.
  if (rows.length === 0 || !rows[0].importacion_id) {
    return null;
  }

  return rows[0] as UltimoItemProveedor;
}

/**
 * Lista las importaciones de un proveedor (opcional)
 */
export async function getImportacionesByProveedor(id_proveedor: number) {
  const { rows } = await query(
    `SELECT * FROM public.proveedor_importacion WHERE id_proveedor = $1 ORDER BY created_at DESC`,
    [id_proveedor]
  );
  return rows as ProveedorImportacion[];
}
