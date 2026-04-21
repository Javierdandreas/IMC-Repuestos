import { Pool } from "pg";
import fs from "fs";
import path from "path";

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
const connectionString = process.env.DATABASE_URL;

// En producción, verificar certificados SSL por defecto.
const rejectUnauthorized =
  (process.env.DB_SSL_REJECT_UNAUTHORIZED ?? (process.env.NODE_ENV === "production" ? "true" : "false"))
    .toLowerCase() === "true";

// Ruta al certificado CA si existe
const caPath = process.env.DB_SSL_CA_PATH ? path.resolve(process.cwd(), process.env.DB_SSL_CA_PATH) : null;

function buildSslConfig(): false | { rejectUnauthorized: boolean; ca?: string } {
  const isDev = process.env.NODE_ENV !== "production";
  
  if (!sslEnabled && !connectionString) return false;

  const config: { rejectUnauthorized: boolean; ca?: string } = {
    rejectUnauthorized: isDev ? false : rejectUnauthorized 
  };

  // Si se configuró un certificado CA, lo cargamos
  if (caPath && fs.existsSync(caPath)) {
    try {
      config.ca = fs.readFileSync(caPath).toString();
      // En desarrollo, mantenemos rejectUnauthorized: false para evitar errores de certificados 
      // autofirmados, pero usamos el CA para la conexión. En prod, forzamos true.
      config.rejectUnauthorized = isDev ? false : true;
      if (isDev) console.log("🔒 SSL: Usando certificado CA de Supabase (modo tolerante en dev).");
    } catch (err) {
      console.warn("⚠️ SSL: No se pudo leer el certificado CA en la ruta:", caPath);
    }
  }

  return config;
}

const globalForPg = globalThis as unknown as {
  __imcPgPool?: Pool;
};

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

// LOGS DE DIAGNÓSTICO (Solo en desarrollo)
if (process.env.NODE_ENV !== "production") {
  const diagnostic = connectionString 
    ? { connectionString: connectionString.replace(/:([^:@]+)@/, ":****@"), ssl: !!poolConfig.ssl }
    : { host: poolConfig.host, port: poolConfig.port, user: poolConfig.user, ssl: !!poolConfig.ssl };
  
  console.log("🔌 Inicializando Pool de base de datos:", diagnostic);
}

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
