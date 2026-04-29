import { pool } from "@/utils/database";
import { AuthenticatedInternalUser, InternalUserRow } from "../types/auth.types";
import { normalizeRole } from "./permissions";

function mapInternalUser(row: InternalUserRow): AuthenticatedInternalUser {
  return {
    authUserId: row.authUserId,
    usuarioId: Number(row.usuarioId),
    email: row.email,
    nombre: row.nombre,
    apellido: row.apellido,
    nombreUsuario: row.nombreUsuario,
    rol: normalizeRole(row.rol),
    activo: Boolean(row.activo),
  };
}

/**
 * Obtiene la lista completa de usuarios del sistema desde las tablas canónicas.
 */
export async function obtenerTodosLosUsuarios(): Promise<AuthenticatedInternalUser[]> {
  try {
    const { rows } = await pool.query<InternalUserRow>(
      `
        SELECT
          ua.auth_user_id AS "authUserId",
          ua.usuario_id AS "usuarioId",
          du.email,
          du.nombre,
          du.apellido,
          u.nombre_usuario AS "nombreUsuario",
          ua.rol,
          ua.activo
        FROM public.usuario_auth ua
        JOIN public.usuario u ON u.id = ua.usuario_id
        LEFT JOIN public.detalle_usuario du ON du.id = ua.usuario_id
        ORDER BY du.apellido ASC, du.nombre ASC
      `
    );

    return rows.map(mapInternalUser);
  } catch (error) {
    console.error("Error en obtenerTodosLosUsuarios:", error);
    throw error;
  }
}

/**
 * Actualiza el estado de un usuario (activo/inactivo) y su rol.
 */
export async function actualizarEstadoUsuario(authUserId: string, patch: { activo?: boolean; rol?: string }) {
  try {
    const fields = [];
    const values = [];
    let i = 1;

    if (patch.activo !== undefined) {
      fields.push(`activo = $${i++}`);
      values.push(patch.activo);
    }

    if (patch.rol !== undefined) {
      fields.push(`rol = $${i++}`);
      values.push(patch.rol);
    }

    if (fields.length === 0) return;

    values.push(authUserId);
    const query = `
      UPDATE public.usuario_auth 
      SET ${fields.join(", ")} 
      WHERE auth_user_id = $${i}
    `;

    await pool.query(query, values);
  } catch (error) {
    console.error("Error en actualizarEstadoUsuario:", error);
    throw error;
  }
}
