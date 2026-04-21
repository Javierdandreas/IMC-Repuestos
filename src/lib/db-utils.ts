import { pool } from "@/utils/database";
import type { PoolClient, QueryResult, QueryResultRow } from "pg";

export type DbClient = Pick<PoolClient, "query">;

/**
 * Envolve una función asíncrona dentro de una transacción de PostgreSQL.
 * Realiza COMMIT si la función se ejecuta con éxito, o ROLLBACK si lanza un error.
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (err) {
      console.error("Error al realizar rollback:", err);
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Ejecuta una consulta simple sin necesidad de manejar el pool manualmente.
 */
export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  return await pool.query(text, params);
}

/**
 * Helper para realizar consultas paginadas de forma genérica.
 */
export async function paginateQuery<T extends QueryResultRow>(
  table: string,
  dataQuery: string,
  page: number = 1,
  limit: number = 50,
  params: any[] = []
): Promise<{ data: T[]; totalCount: number; totalPages: number }> {
  // SEGURIDAD: Validar que la tabla esté en una lista blanca para evitar SQL Injection dinámica
  const ALLOWED_TABLES = [
    "productos",
    "marcas",
    "proveedores",
    "ubicaciones",
    "categoria",
    "subcategoria",
    "pieza",
    "log_importaciones",
    "kits",
  ];

  if (!ALLOWED_TABLES.includes(table)) {
    throw new Error(`Acceso denegado a la tabla: ${table}`);
  }

  // SEGURIDAD: Evitar que dataQuery contenga múltiples sentencias o caracteres sospechosos
  if (dataQuery.includes(";") || dataQuery.toLowerCase().includes("drop ") || dataQuery.toLowerCase().includes("truncate ")) {
    throw new Error("Consulta denegada por motivos de seguridad.");
  }

  const limitNum = Math.max(1, limit);
  const offset = Math.max(0, (page - 1) * limitNum);

  // Consulta el total de registros usando una subconsulta para mayor precisión y seguridad
  const countSql = `SELECT COUNT(*) FROM (${dataQuery}) AS count_subquery`;
  const countResult = await query(countSql, params);
  const totalCount = parseInt(countResult.rows[0].count, 10);
  const totalPages = Math.ceil(totalCount / limitNum);

  if (totalCount === 0) {
    return { data: [], totalCount: 0, totalPages: 0 };
  }

  // Agrega limit y offset al final de la consulta de datos
  const finalSql = `${dataQuery} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  const { rows } = await query(finalSql, [...params, limitNum, offset]);

  return { data: rows as T[], totalCount, totalPages };
}

