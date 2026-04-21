import { Pool } from "pg";
import fs from "fs";
import path from "path";
function getEnvOptional(name: string): string | undefined {
  const value = process.env[name];
  if (!value) return undefined;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getPortOptional(): number | undefined {
  const raw = getEnvOptional("DB_PORT");
  if (!raw) return undefined;

  const port = Number(raw);
  return Number.isInteger(port) && port > 0 ? port : undefined;
}

const isProd = process.env.NODE_ENV === "production";

const sslEnabled =
  (process.env.DB_SSL ?? "false").toLowerCase() === "true";

const rejectUnauthorized =
  (process.env.DB_SSL_REJECT_UNAUTHORIZED ??
    (isProd ? "true" : "false")
  ).toLowerCase() === "true";

const rawConnectionString = process.env.DATABASE_URL;

/**
 * Muy importante:
 * si la URL trae ?sslmode=require u otro sslmode,
 * lo quitamos para que no pise el objeto ssl de pg.
 */
const connectionString = rawConnectionString?.replace(
  /([?&])sslmode=[^&]*&?/gi,
  "$1"
).replace(/[?&]$/, "");

/**
 * Si el cert viene desde Vercel como multilinea, entra tal cual.
 * Si viene escapado con \n, esto lo normaliza.
 */
const caFromEnv = process.env.DB_SSL_CA_CERT?.replace(/\\n/g, "\n");

function buildSslConfig():
  | false
  | {
      rejectUnauthorized: boolean;
      ca?: string;
    } {
  if (!sslEnabled) return false;

  const config: {
    rejectUnauthorized: boolean;
    ca?: string;
  } = {
    rejectUnauthorized,
  };

  if (caFromEnv) {
    config.ca = caFromEnv;
  }

  if (isProd && rejectUnauthorized && !config.ca) {
    throw new Error(
      "SSL estricto activado pero falta DB_SSL_CA_CERT."
    );
  }

  return config;
}

const commonConfig = {
  max: Number(process.env.DB_POOL_MAX ?? 10),
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS ?? 30000),
  connectionTimeoutMillis: Number(
    process.env.DB_CONNECTION_TIMEOUT_MS ?? 10000
  ),
  ssl: buildSslConfig(),
};

const poolConfig = connectionString
  ? {
      connectionString,
      ...commonConfig,
    }
  : {
      host: getEnvOptional("DB_HOST"),
      port: getPortOptional(),
      user: getEnvOptional("DB_USER"),
      password: getEnvOptional("DB_PASSWORD"),
      database: getEnvOptional("DB_NAME"),
      ...commonConfig,
    };

type GlobalWithPg = typeof globalThis & {
  __imcPgPool?: Pool;
};

const globalForPg = globalThis as GlobalWithPg;

export const pool =
  globalForPg.__imcPgPool ?? new Pool(poolConfig);

pool.on("error", (err) => {
  console.error("❌ Error inesperado en el pool PostgreSQL:", {
    message: err.message,
    code: (err as NodeJS.ErrnoException).code,
    stack: err.stack,
  });
});

if (!isProd) {
  globalForPg.__imcPgPool = pool;
}

export default pool;