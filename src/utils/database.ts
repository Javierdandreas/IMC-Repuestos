import { Pool } from "pg";

const isProd = process.env.NODE_ENV === "production";

// Función para obtener la configuración del pool de forma perezosa
function getPoolConfig() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    // Si no hay URL, intentamos con variables individuales (fallback)
    return {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 5432),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: { rejectUnauthorized: false }
    };
  }

  return {
    connectionString,
    // Forzamos SSL con rejectUnauthorized: false para evitar problemas de certificados auto-firmados
    ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
    max: Number(process.env.DB_POOL_MAX ?? 10),
    idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS ?? 30000),
    connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS ?? 10000),
  };
}

type GlobalWithPg = typeof globalThis & {
  __imcPgPool?: Pool;
};

const globalForPg = globalThis as GlobalWithPg;

// Exportamos el pool directamente, pero el constructor se ejecutará cuando se importe
// Para el script, necesitamos que el pool se cree DESPUÉS de dotenv.config()
// Así que lo envolvemos en un proxy o lo inicializamos bajo demanda.

let _pool: Pool | null = null;

export const getPool = () => {
    if (!_pool) {
        if (!isProd && globalForPg.__imcPgPool) {
            _pool = globalForPg.__imcPgPool;
        } else {
            _pool = new Pool(getPoolConfig());
            if (!isProd) globalForPg.__imcPgPool = _pool;
        }
    }
    return _pool;
};

// Mantenemos la exportación del pool por compatibilidad, pero será inicializado el primer acceso
export const pool = new Proxy({} as Pool, {
    get(target, prop: keyof Pool) {
        const p = getPool();
        const val = p[prop];
        if (typeof val === 'function') return val.bind(p);
        return val;
    }
});

export default pool;