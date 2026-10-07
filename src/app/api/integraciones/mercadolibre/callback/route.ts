import { NextRequest, NextResponse } from "next/server";

import { verifyInternalUserFromRequest } from "@/lib/auth";
import { conectarMercadoLibre } from "@/lib/mercadolibre";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATE_COOKIE = "imc_meli_oauth_state";

function redirectToSettings(request: NextRequest, state: "conectado" | "error", message?: string) {
  const url = new URL("/configuracion/mercadolibre", request.url);
  url.searchParams.set("meli", state);
  if (message) url.searchParams.set("mensaje", message.slice(0, 180));
  const response = NextResponse.redirect(url);
  response.cookies.set(STATE_COOKIE, "", { httpOnly: true, maxAge: 0, path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  return response;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get(STATE_COOKIE)?.value;
  const externalError = request.nextUrl.searchParams.get("error");
  if (externalError) return redirectToSettings(request, "error", "Mercado Libre no autorizo la conexion.");
  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectToSettings(request, "error", "La validacion de seguridad vencio. Volve a iniciar la conexion.");
  }
  try {
    const session = await verifyInternalUserFromRequest(request);
    if (!session?.activo || session.rol !== "admin") {
      return redirectToSettings(request, "error", "Tu sesion no tiene permisos para conectar Mercado Libre.");
    }
    await conectarMercadoLibre(code);
    return redirectToSettings(request, "conectado");
  } catch (error) {
    return redirectToSettings(request, "error", error instanceof Error ? error.message : "No se pudo conectar la cuenta.");
  }
}
