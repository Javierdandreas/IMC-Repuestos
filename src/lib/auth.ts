import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { pool } from "@/utils/database";

type AuthenticatedInternalUser = {
  authUserId: string;
  usuarioId: number;
  rol: string;
  activo: boolean;
  email: string | null;
  nombre: string | null;
  apellido: string | null;
  nombreUsuario: string | null;
};

type UsuarioAuthRow = {
  usuario_id: number;
  rol: string | null;
  activo: boolean | null;
};

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Falta la variable de entorno ${name}`);
  }
  return value.trim();
}

function getSupabaseConfig() {
  return {
    supabaseUrl: getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    supabaseKey: getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  };
}

export function createRequestSupabaseClient(request: NextRequest) {
  const { supabaseUrl, supabaseKey } = getSupabaseConfig();

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {
        // El middleware ya se encarga de refrescar las cookies de sesión.
      },
    },
  });
}

export async function createCookieSupabaseClient() {
  const { supabaseUrl, supabaseKey } = getSupabaseConfig();
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // En server components puede no ser posible mutar cookies.
        }
      },
    },
  });
}

async function getUsuarioAuthBySupabaseClient(
  supabase: SupabaseClient,
  authUserId: string
): Promise<UsuarioAuthRow | null> {
  const { data, error } = await supabase
    .from("usuario_auth")
    .select("usuario_id, rol, activo")
    .eq("auth_user_id", authUserId)
    .maybeSingle<UsuarioAuthRow>();

  if (error || !data) {
    return null;
  }

  return data;
}

async function getInternalUserProfile(
  authUserId: string,
  usuarioId: number,
  rol: string,
  activo: boolean
): Promise<AuthenticatedInternalUser | null> {
  const { rows } = await pool.query<AuthenticatedInternalUser>(
    `
      SELECT
        $1::text AS "authUserId",
        u.id AS "usuarioId",
        $3::text AS rol,
        $4::boolean AS activo,
        du.email,
        du.nombre,
        du.apellido,
        u.nombre_usuario AS "nombreUsuario"
      FROM public.usuario u
      LEFT JOIN public.detalle_usuario du ON du.id = u.id
      WHERE u.id = $2
      LIMIT 1
    `,
    [authUserId, usuarioId, rol, activo]
  );

  return rows[0] ?? null;
}

export async function findInternalUserByAuthUserId(
  authUserId: string,
  supabase?: SupabaseClient
): Promise<AuthenticatedInternalUser | null> {
  const supabaseClient = supabase ?? (await createCookieSupabaseClient());
  const usuarioAuth = await getUsuarioAuthBySupabaseClient(supabaseClient, authUserId);

  if (!usuarioAuth || !usuarioAuth.usuario_id || usuarioAuth.activo !== true) {
    return null;
  }

  return getInternalUserProfile(
    authUserId,
    usuarioAuth.usuario_id,
    usuarioAuth.rol ?? "usuario",
    true
  );
}

export async function verifyInternalUserFromRequest(
  request: NextRequest
): Promise<AuthenticatedInternalUser | null> {
  const supabase = createRequestSupabaseClient(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return findInternalUserByAuthUserId(user.id, supabase);
}

export async function verifyInternalUserFromCookies(): Promise<AuthenticatedInternalUser | null> {
  const supabase = await createCookieSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return findInternalUserByAuthUserId(user.id, supabase);
}

export type { AuthenticatedInternalUser };
