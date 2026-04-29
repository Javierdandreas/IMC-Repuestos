import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { pool } from "@/utils/database";
import { createClient as createCookieSupabaseClient } from "@/utils/supabase/server";
import { canReadContent, normalizeRole } from "./permissions";
import { AuthenticatedInternalUser, InternalUserRow } from "../types/auth.types";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Falta la variable de entorno ${name}`);
  }
  return value.trim();
}

function createRequestSupabaseClient(request: NextRequest) {
  const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseKey = getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

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

export function createRouteHandlerSupabaseClient(
  request: NextRequest,
  response: NextResponse
) {
  const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseKey = getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return createServerClient(supabaseUrl, supabaseKey, {
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
  });
}

function mapInternalUser(row: InternalUserRow | null | undefined): AuthenticatedInternalUser | null {
  if (!row) return null;

  return {
    authUserId: row.authUserId,
    usuarioId: Number(row.usuarioId),
    email: row.email,
    nombre: row.nombre,
    apellido: row.apellido,
    nombreUsuario: row.nombreUsuario,
    rol: normalizeRole(row.rol),
    activo: Boolean(row.activo),
  };
}

export function canAccessApp(session: AuthenticatedInternalUser | null | undefined): boolean {
  return Boolean(session && session.activo && canReadContent(session.rol));
}

export async function findInternalUserByAuthUserId(
  authUserId: string
): Promise<AuthenticatedInternalUser | null> {
  try {
    const { rows } = await pool.query<InternalUserRow>(
      `
        SELECT
          ua.auth_user_id AS "authUserId",
          ua.usuario_id AS "usuarioId",
          du.email,
          du.nombre,
          du.apellido,
          u.nombre_usuario AS "nombreUsuario",
          ua.rol,
          ua.activo
        FROM public.usuario_auth ua
        JOIN public.usuario u ON u.id = ua.usuario_id
        LEFT JOIN public.detalle_usuario du ON du.id = ua.usuario_id
        WHERE ua.auth_user_id = $1
        LIMIT 1
      `,
      [authUserId]
    );

    return mapInternalUser(rows[0]);
  } catch (error: any) {
    console.error("❌ Error en findInternalUserByAuthUserId:", {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      stack: error.stack
    });
    throw error;
  }
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

  return findInternalUserByAuthUserId(user.id);
}

export async function getServerInternalUser(): Promise<AuthenticatedInternalUser | null> {
  const cookieStore = await cookies();
  const supabase = createCookieSupabaseClient(cookieStore);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  return findInternalUserByAuthUserId(user.id);
}
