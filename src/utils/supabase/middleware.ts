import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

type MiddlewareSessionResult = {
  response: NextResponse;
  authUserId: string | null;
  usuarioId: number | null;
  rol: string | null;
  activo: boolean;
};

export async function updateSession(request: NextRequest): Promise<MiddlewareSessionResult> {
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      response: supabaseResponse,
      authUserId: null,
      usuarioId: null,
      rol: null,
      activo: false,
    };
  }

  const { data: usuarioAuth, error } = await supabase
    .from("usuario_auth")
    .select("usuario_id, rol, activo")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error || !usuarioAuth || usuarioAuth.activo !== true) {
    return {
      response: supabaseResponse,
      authUserId: user.id,
      usuarioId: null,
      rol: null,
      activo: false,
    };
  }

  return {
    response: supabaseResponse,
    authUserId: user.id,
    usuarioId: usuarioAuth.usuario_id ?? null,
    rol: usuarioAuth.rol ?? null,
    activo: true,
  };
}
