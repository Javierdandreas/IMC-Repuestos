import { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/api-errors";
import { findInternalUserByAuthUserId, canAccessApp } from "../repos/auth";
import { AuthenticatedInternalUser } from "../types/auth.types";

export class AuthService {
  /**
   * Intenta iniciar sesiÃ³n con Supabase y valida el usuario interno.
   * Retorna el usuario interno si todo es correcto.
   */
  static async login(
    email: string,
    password: string,
    supabase: SupabaseClient
  ): Promise<AuthenticatedInternalUser> {
    const normalizedEmail = String(email ?? "").trim().toLowerCase();
    const normalizedPassword = String(password ?? "");

    if (!normalizedEmail || !normalizedPassword) {
      throw new AppError("Email y contraseÃ±a son obligatorios", 400);
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: normalizedPassword,
    });

    if (signInError) {
      throw new AppError("Email o contraseÃ±a incorrectos", 401);
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      await supabase.auth.signOut();
      throw new AppError("No se pudo validar la sesiÃ³n", 401);
    }

    const internalUser = await findInternalUserByAuthUserId(user.id);

    if (!internalUser || !internalUser.activo || !canAccessApp(internalUser)) {
      await supabase.auth.signOut();
      throw new AppError("Usuario autenticado pero sin acceso habilitado en IMC", 403);
    }

    return internalUser;
  }

  /**
   * Cierra la sesiÃ³n en Supabase.
   */
  static async logout(supabase: SupabaseClient): Promise<void> {
    await supabase.auth.signOut();
  }
}
