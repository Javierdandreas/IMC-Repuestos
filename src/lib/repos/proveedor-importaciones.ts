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
        VALUES ($1, $2, $3, 'PENDIENTE')
        RETURNING *
      `,
      [id_proveedor, nombre_archivo, items.length]
    );

    const importacion = headerResult.rows[0] as ProveedorImportacion;

    // 2. Insertar ítems masivamente (Bulk Insert)
    // Preparamos los arrays para UNNEST
    const v_codigo = items.map(i => i.codigo_proveedor);
    const v_desc = items.map(i => i.descripcion);
    const v_marca = items.map(i => i.marca_texto || null);
    const v_precio = items.map(i => i.precio_lista);
    const v_disp = items.map(i => i.disponibilidad || null);
    const v_obs = items.map(i => i.observacion || null);

    await client.query(
      `
        INSERT INTO public.proveedor_importacion_item (
          id_importacion, codigo_proveedor, descripcion, marca_texto, precio_lista, disponibilidad, observacion
        )
        SELECT $1, * FROM UNNEST(
          $2::text[], $3::text[], $4::text[], $5::numeric[], $6::text[], $7::text[]
        )
      `,
      [importacion.id, v_codigo, v_desc, v_marca, v_precio, v_disp, v_obs]
    );

    return importacion;
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
