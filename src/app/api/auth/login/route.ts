import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerSupabaseClient } from "@/modules/auth/repos/auth";
import { AuthService } from "@/modules/auth/services/auth-service";
import { rateLimit, getRequestIp } from "@/lib/rate-limit";
import { jsonError } from "@/lib/api-errors";

const LOGIN_RATE_LIMIT = 5;          // mÃ¡x. intentos
const LOGIN_RATE_WINDOW_MS = 300_000; // por 5 minutos

export async function POST(request: NextRequest) {
  // ── Rate limiting ──────────────────────────────────────
  const ip = getRequestIp(request.headers);
  const rl = rateLimit(ip, LOGIN_RATE_LIMIT, LOGIN_RATE_WINDOW_MS);

  if (!rl.allowed) {
    const retryAfterSeconds = Math.ceil(rl.retryAfterMs / 1000);
    return NextResponse.json(
      { 
        message: "Demasiados intentos de inicio de sesión. Intentá de nuevo en unos segundos.",
        retryAfterSeconds 
      },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfterSeconds) },
      }
    );
  }

  const response = NextResponse.json({ ok: true });
  const supabase = createRouteHandlerSupabaseClient(request, response);

  try {
    const { email, password } = await request.json();
    
    await AuthService.login(email, password, supabase);

    return response;
  } catch (error: unknown) {
    return jsonError(error, "No se pudo iniciar sesión por un error interno.");
  }
}
