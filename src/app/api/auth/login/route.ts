import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { findInternalUserByAuthUserId } from "@/lib/auth";
import { canReadContent } from "@/lib/permissions";
import { rateLimit, getRequestIp } from "@/lib/rate-limit";
import { jsonError } from "@/lib/api-errors";

const LOGIN_RATE_LIMIT = 5;          // máx. intentos
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

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  try {
    const { email, password } = await request.json();

    const normalizedEmail = String(email ?? "").trim().toLowerCase();
    const normalizedPassword = String(password ?? "");

    if (!normalizedEmail || !normalizedPassword) {
      return NextResponse.json(
        { message: "Email y contraseña son obligatorios" },
        { status: 400 }
      );
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: normalizedPassword,
    });

    if (signInError) {
      return NextResponse.json(
        { message: "Email o contraseña incorrectos" },
        { status: 401 }
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      await supabase.auth.signOut();
      return NextResponse.json(
        { message: "No se pudo validar la sesión" },
        { status: 401 }
      );
    }

    const internalUser = await findInternalUserByAuthUserId(user.id);

    if (!internalUser || !internalUser.activo || !canReadContent(internalUser.rol)) {
      await supabase.auth.signOut();
      return NextResponse.json(
        { message: "Usuario autenticado pero sin acceso habilitado en IMC" },
        { status: 403 }
      );
    }

    return response;
  } catch (error: unknown) {
    await supabase.auth.signOut();
    return jsonError(error, "No se pudo iniciar sesión");
  }
}
