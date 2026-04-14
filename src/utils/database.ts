import { Pool } from "pg";

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

// En producción, verificar certificados SSL por defecto.
// Se puede desactivar explícitamente con DB_SSL_REJECT_UNAUTHORIZED=false (solo para desarrollo local).
const rejectUnauthorized =
  (process.env.DB_SSL_REJECT_UNAUTHORIZED ?? (process.env.NODE_ENV === "production" ? "true" : "false"))
    .toLowerCase() === "true";

function buildSslConfig(): false | { rejectUnauthorized: boolean } {
  if (!sslEnabled && !process.env.DATABASE_URL) return false;
  return { rejectUnauthorized };
}

const globalForPg = globalThis as unknown as {
  __imcPgPool?: Pool;
};

const connectionString = process.env.DATABASE_URL;

const poolConfig = connectionString
  ? {
    connectionString,
    ssl: buildSslConfig(),
    max: Number(process.env.DB_POOL_MAX ?? 10),
    idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS ?? 30000),
    connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS ?? 10000),
  }
  : {
    host: getEnvOptional("DB_HOST"),
    port: getPortOptional(),
    user: getEnvOptional("DB_USER"),
    password: getEnvOptional("DB_PASSWORD"),
    database: getEnvOptional("DB_NAME"),
    ssl: buildSslConfig(),
    max: Number(process.env.DB_POOL_MAX ?? 10),
    idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS ?? 30000),
    connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS ?? 10000),
  };

export const pool = globalForPg.__imcPgPool ?? new Pool(poolConfig);

// Agregar listener de errores globales al pool para diagnóstico
pool.on('error', (err) => {
  console.error('❌ Error inesperado en el pool de PostgreSQL:', err.message);
  if (err.stack) console.error(err.stack);
});

if (process.env.NODE_ENV !== "production") {
  globalForPg.__imcPgPool = pool;
}

export default pool;
