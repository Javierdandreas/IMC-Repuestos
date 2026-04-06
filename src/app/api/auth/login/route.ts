import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, getAdminCredentials, getSessionCookieName, getSessionMaxAge } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();
    const creds = getAdminCredentials();

    if (String(username ?? "").trim() !== creds.user || String(password ?? "") !== creds.password) {
      return NextResponse.json({ message: "Usuario o contraseña incorrectos" }, { status: 401 });
    }

    const token = await createSessionToken(creds.user);
    const response = NextResponse.json({ ok: true });
    response.cookies.set({
      name: getSessionCookieName(),
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: getSessionMaxAge(),
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || "No se pudo iniciar sesión" },
      { status: 400 }
    );
  }
}
