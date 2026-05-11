import { query, withTransaction, DbClient } from "@/lib/db-utils";
import { Ubicacion } from "@/modules/ubicaciones/types/ubicaciones";

export interface ProductoUbicacionRel {
  id: number;
  id_producto: number;
  id_ubicacion: number;
  es_principal: boolean;
  activo: boolean;
  ubicacion?: Ubicacion;
}

/**
 * Lista todas las ubicaciones asociadas a un producto.
 */
export async function listarUbicacionesDeProducto(idProducto: number | string): Promise<ProductoUbicacionRel[]> {
  const sql = `
    SELECT pu.*, 
           u.codigo as u_codigo, u.codigo_barra as u_codigo_barra, 
           u.sector_codigo as u_sector_codigo, u.estanteria as u_estanteria, 
           u.nivel as u_nivel, u.posicion as u_posicion, u.descripcion as u_descripcion
    FROM public.producto_ubicacion pu
    JOIN public.ubicaciones u ON pu.id_ubicacion = u.id
    WHERE pu.id_producto = $1 AND pu.activo = true
    ORDER BY pu.es_principal DESC, u.codigo ASC
  `;
  const { rows } = await query(sql, [idProducto]);
  
  return rows.map(r => ({
    id: r.id,
    id_producto: r.id_producto,
    id_ubicacion: r.id_ubicacion,
    es_principal: r.es_principal,
    activo: r.activo,
    ubicacion: {
      id: r.id_ubicacion,
      codigo: r.u_codigo,
      codigo_barra: r.u_codigo_barra,
      sector_codigo: r.u_sector_codigo,
      estanteria: r.u_estanteria,
      nivel: r.u_nivel,
      posicion: r.u_posicion,
      descripcion: r.u_descripcion
    }
  }));
}

/**
 * Agrega una ubicación a un producto. 
 * Si es la primera, se marca como principal.
 */
export async function agregarUbicacionAProducto(
  idProducto: number | string, 
  idUbicacion: number | string,
  existingClient?: DbClient
) {
  const logic = async (client: DbClient) => {
    // Verificar si ya existe
    const existsSql = "SELECT id, es_principal, activo FROM public.producto_ubicacion WHERE id_producto = $1 AND id_ubicacion = $2";
    const { rows: existing } = await client.query(existsSql, [idProducto, idUbicacion]);

    if (existing.length > 0) {
      if (existing[0].activo) return existing[0];
      // Si existía pero estaba inactivo, lo reactivamos
      await client.query("UPDATE public.producto_ubicacion SET activo = true WHERE id = $1", [existing[0].id]);
      return existing[0];
    }

    // Verificar si ya tiene principal
    const principalSql = "SELECT id FROM public.producto_ubicacion WHERE id_producto = $1 AND es_principal = true AND activo = true";
    const { rows: principals } = await client.query(principalSql, [idProducto]);
    const esPrincipal = principals.length === 0;

    const insertSql = `
      INSERT INTO public.producto_ubicacion (id_producto, id_ubicacion, es_principal)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const { rows } = await client.query(insertSql, [idProducto, idUbicacion, esPrincipal]);

    if (esPrincipal) {
      await sincronizarPrincipalConProducto(idProducto, idUbicacion, client);
    }

    return rows[0];
  };

  if (existingClient) return await logic(existingClient);
  return await withTransaction(logic);
}

/**
 * Marca una ubicación como principal para un producto.
 */
export async function marcarUbicacionPrincipal(
  idProducto: number | string, 
  idUbicacion: number | string, 
  existingClient?: DbClient
) {
  const logic = async (client: DbClient) => {
    // 1. Quitar principal a todas las demás
    await client.query(
      "UPDATE public.producto_ubicacion SET es_principal = false WHERE id_producto = $1",
      [idProducto]
    );

    // 2. Marcar esta como principal (y asegurar que esté activa)
    const updateSql = `
      UPDATE public.producto_ubicacion 
      SET es_principal = true, activo = true 
      WHERE id_producto = $1 AND id_ubicacion = $2
      RETURNING *
    `;
    const { rows } = await client.query(updateSql, [idProducto, idUbicacion]);

    // Si no existía la relación, la creamos
    if (rows.length === 0) {
      await client.query(
        "INSERT INTO public.producto_ubicacion (id_producto, id_ubicacion, es_principal) VALUES ($1, $2, true)",
        [idProducto, idUbicacion]
      );
    }

    // 3. Sincronizar con productos.id_ubicacion
    await sincronizarPrincipalConProducto(idProducto, idUbicacion, client);

    return rows[0];
  };

  if (existingClient) return await logic(existingClient);
  return await withTransaction(logic);
}

/**
 * Quita una ubicación de un producto (la desactiva).
 */
export async function quitarUbicacionDeProducto(
  idProducto: number | string, 
  idUbicacion: number | string,
  existingClient?: DbClient
) {
  const logic = async (client: DbClient) => {
    // Primero verificamos si es la principal antes de quitarla
    const checkSql = "SELECT es_principal FROM public.producto_ubicacion WHERE id_producto = $1 AND id_ubicacion = $2 AND activo = true";
    const { rows: check } = await client.query(checkSql, [idProducto, idUbicacion]);
    const wasPrincipal = check.length > 0 && check[0].es_principal;

    await client.query(
      "UPDATE public.producto_ubicacion SET activo = false, es_principal = false WHERE id_producto = $1 AND id_ubicacion = $2",
      [idProducto, idUbicacion]
    );

    if (wasPrincipal) {
      // Si quitamos la principal, buscamos otra para heredar el puesto
      const nextSql = "SELECT id_ubicacion FROM public.producto_ubicacion WHERE id_producto = $1 AND activo = true ORDER BY id ASC LIMIT 1";
      const { rows: next } = await client.query(nextSql, [idProducto]);
      
      if (next.length > 0) {
        await marcarUbicacionPrincipal(idProducto, next[0].id_ubicacion, client);
      } else {
        // No quedan ubicaciones, limpiamos productos.id_ubicacion
        await client.query("UPDATE public.productos SET id_ubicacion = NULL WHERE id = $1", [idProducto]);
      }
    }
  };

  if (existingClient) return await logic(existingClient);
  return await withTransaction(logic);
}

/**
 * Reemplaza todas las ubicaciones de un producto.
 */
export async function reemplazarUbicacionesDeProducto(idProducto: number | string, ubicacionIds: (number | string)[]) {
  return await withTransaction(async (client) => {
    // 1. Desactivar todas
    await client.query("UPDATE public.producto_ubicacion SET activo = false, es_principal = false WHERE id_producto = $1", [idProducto]);

    if (ubicacionIds.length === 0) {
      await client.query("UPDATE public.productos SET id_ubicacion = NULL WHERE id = $1", [idProducto]);
      return;
    }

    // 2. Insertar/Activar las nuevas
    for (let i = 0; i < ubicacionIds.length; i++) {
      const idUbi = ubicacionIds[i];
      const esPrincipal = i === 0;
      
      await client.query(`
        INSERT INTO public.producto_ubicacion (id_producto, id_ubicacion, es_principal, activo)
        VALUES ($1, $2, $3, true)
        ON CONFLICT (id_producto, id_ubicacion) DO UPDATE
        SET es_principal = EXCLUDED.es_principal, activo = true
      `, [idProducto, idUbi, esPrincipal]);

      if (esPrincipal) {
        await sincronizarPrincipalConProducto(idProducto, idUbi, client);
      }
    }
  });
}

/**
 * Asignación masiva de ubicación.
 */
export async function asignarUbicacionAProductosMasivo(
  productoIds: (number | string)[], 
  idUbicacion: number | string, 
  modo: 'agregar_adicional' | 'marcar_principal' | 'reemplazar_todas' = 'agregar_adicional'
) {
  return await withTransaction(async (client) => {
    for (const idProd of productoIds) {
      if (modo === 'reemplazar_todas') {
        await reemplazarUbicacionesDeProducto(idProd, [idUbicacion]);
      } else if (modo === 'marcar_principal') {
        await marcarUbicacionPrincipal(idProd, idUbicacion);
      } else {
        // agregar_adicional
        await agregarUbicacionAProducto(idProd, idUbicacion);
      }
    }
  });
}

/**
 * Mantiene productos.id_ubicacion sincronizado con la principal de producto_ubicacion.
 */
async function sincronizarPrincipalConProducto(idProducto: number | string, idUbicacion: number | string | null, client: DbClient) {
  await client.query(
    "UPDATE public.productos SET id_ubicacion = $2 WHERE id = $1",
    [idProducto, idUbicacion]
  );
}

/**
 * Obtiene los IDs de productos asociados a una ubicación (ya sea como principal o adicional).
 */
export async function obtenerProductosAsociadosAUbicacion(idUbicacion: number | string): Promise<number[]> {
  const sql = `
    SELECT DISTINCT p.id
    FROM public.productos p
    LEFT JOIN public.producto_ubicacion pu ON p.id = pu.id_producto AND pu.activo = true
    WHERE p.id_ubicacion = $1 OR pu.id_ubicacion = $1
  `;
  const { rows } = await query(sql, [idUbicacion]);
  return rows.map(r => r.id);
}

