import { Pool } from "pg";

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Falta la variable de entorno ${name}`);
  }
  return value.trim();
}

function getEnvOptional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

function getPortOptional(): number | undefined {
  const raw = getEnvOptional("DB_PORT");
  if (!raw) return undefined;
  const port = Number(raw);
  return Number.isInteger(port) && port > 0 ? port : undefined;
}

const sslEnabled = (process.env.DB_SSL ?? "false").toLowerCase() === "true";

const globalForPg = globalThis as unknown as {
  __imcPgPool?: Pool;
};

const connectionString = process.env.DATABASE_URL;

export const pool =
  globalForPg.__imcPgPool ??
  (connectionString
    ? new Pool({
        connectionString,
        ssl: { rejectUnauthorized: false },
        max: Number(process.env.DB_POOL_MAX ?? 10),
        idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS ?? 30000),
        connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS ?? 10000),
      })
    : new Pool({
        host: getEnvOptional("DB_HOST"),
        port: getPortOptional(),
        user: getEnvOptional("DB_USER"),
        password: getEnvOptional("DB_PASSWORD"),
        database: getEnvOptional("DB_NAME"),
        ssl: sslEnabled ? { rejectUnauthorized: false } : false,
        max: Number(process.env.DB_POOL_MAX ?? 10),
        idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS ?? 30000),
        connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS ?? 10000),
      }));

if (process.env.NODE_ENV !== "production") {
  globalForPg.__imcPgPool = pool;
}

export async function query<T = unknown>(text: string, params?: unknown[]) {
  return pool.query<T>(text, params);
}

export default pool;
