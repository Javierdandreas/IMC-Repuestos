const COOKIE_NAME = "imc_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 horas

type SessionPayload = {
  u: string;
  exp: number;
};

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Falta la variable de entorno ${name}`);
  }
  return value.trim();
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "===".slice((normalized.length + 3) % 4);
  return Buffer.from(padded, "base64").toString("utf8");
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function signValue(value: string): Promise<string> {
  const secret = getRequiredEnv("APP_SESSION_SECRET");
  const key = await importHmacKey(secret);
  const enc = new TextEncoder();
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  return Buffer.from(signature)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export async function createSessionToken(username: string): Promise<string> {
  const payload: SessionPayload = {
    u: username,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = await signValue(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = await signValue(encodedPayload);
  if (signature !== expectedSignature) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload;
    if (!payload?.u || !payload?.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getSessionCookieName() {
  return COOKIE_NAME;
}

export function getAdminCredentials() {
  return {
    user: getRequiredEnv("APP_ADMIN_USER"),
    password: getRequiredEnv("APP_ADMIN_PASSWORD"),
  };
}

export function getSessionMaxAge() {
  return SESSION_TTL_SECONDS;
}
