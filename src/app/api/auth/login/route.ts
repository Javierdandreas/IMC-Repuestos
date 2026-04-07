import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { findInternalUserByAuthUserId } from "@/lib/auth";

export async function POST(request: NextRequest) {
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

    const internalUser = await findInternalUserByAuthUserId(user.id, supabase);

    if (!internalUser) {
      await supabase.auth.signOut();
      return NextResponse.json(
        { message: "Usuario autenticado pero sin acceso habilitado en IMC" },
        { status: 403 }
      );
    }

    if (!internalUser.activo) {
      await supabase.auth.signOut();
      return NextResponse.json(
        { message: "Usuario inactivo" },
        { status: 403 }
      );
    }

    return response;
  } catch (error: any) {
    await supabase.auth.signOut();
    return NextResponse.json(
      { message: error?.message || "No se pudo iniciar sesión" },
      { status: 400 }
    );
  }
}
