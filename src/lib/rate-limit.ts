/**
 * Rate limiter in-memory para proteger endpoints sensibles (login, etc).
 *
 * Usa una ventana deslizante por IP. Cada entrada caduca automáticamente
 * y se elimina del Map cuando se comprueba de nuevo (lazy cleanup).
 *
 * ⚠️  Al correr en serverless (ej. Vercel) cada instancia tiene su propia
 *     memoria, así que el límite es "por instancia". Para producción de
 *     alto tráfico considerar un rate limiter distribuido (Upstash, Redis).
 */

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, RateLimitEntry>();

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

/**
 * Verifica si la `key` (normalmente la IP del request) puede ejecutar
 * una acción dentro de la ventana de tiempo.
 *
 * @param key      Identificador único (IP, userId, etc.)
 * @param limit    Máximo de peticiones permitidas dentro de la ventana
 * @param windowMs Tamaño de la ventana en milisegundos
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  // Si no existe o la ventana expiró, reiniciar
  if (!entry || now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterMs: 0 };
  }

  // Dentro de la ventana
  if (entry.count < limit) {
    entry.count += 1;
    return {
      allowed: true,
      remaining: limit - entry.count,
      retryAfterMs: 0,
    };
  }

  // Límite alcanzado
  return {
    allowed: false,
    remaining: 0,
    retryAfterMs: entry.resetAt - now,
  };
}

/**
 * Extrae la IP del request de Next.js.
 * Revisa `x-forwarded-for` (proxies/CDN) y luego cae a `x-real-ip`.
 */
export function getRequestIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for puede tener varias IPs separadas por coma; la primera es la del cliente
    return forwarded.split(",")[0].trim();
  }

  return headers.get("x-real-ip") ?? "unknown";
}
