import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { normalizeRole } from "@/lib/permissions";

type MiddlewareSessionResult = {
  response: NextResponse;
  authUserId: string | null;
  usuarioId: number | null;
  rol: "admin" | "empleado" | "";
  activo: boolean;
  permisos: string[];
};

export async function updateSession(request: NextRequest): Promise<MiddlewareSessionResult> {
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";

  if (!supabaseUrl || !supabaseKey) {
    console.warn("⚠️ NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY no están definidas.");
    return {
      response: supabaseResponse,
      authUserId: null,
      usuarioId: null,
      rol: "",
      activo: false,
      permisos: [],
    };
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      response: supabaseResponse,
      authUserId: null,
      usuarioId: null,
      rol: "",
      activo: false,
      permisos: [],
    };
  }

  const { data: usuarioAuth, error: usuarioAuthError } = await supabase
    .from("usuario_auth")
    .select("usuario_id, rol, activo")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (usuarioAuthError || !usuarioAuth) {
    return {
      response: supabaseResponse,
      authUserId: user.id,
      usuarioId: null,
      rol: "",
      activo: false,
      permisos: [],
    };
  }

  const usuarioId = usuarioAuth.usuario_id ?? null;
  const serviceKey = process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  let permisos: string[] = [];

  if (usuarioId && normalizeRole(usuarioAuth.rol) === "empleado" && serviceKey) {
    const supabaseAdmin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await supabaseAdmin
      .from("usuario_permiso")
      .select("apartado, accion")
      .eq("usuario_id", usuarioId);
    if (error) console.error("No se pudieron consultar los permisos del usuario en middleware:", error.message);
    else permisos = (data || []).map((permiso) => `${permiso.apartado}:${permiso.accion}`);
  }

  return {
    response: supabaseResponse,
    authUserId: user.id,
    usuarioId,
    rol: normalizeRole(usuarioAuth.rol),
    activo: Boolean(usuarioAuth.activo),
    permisos,
  };
}
