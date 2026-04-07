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
