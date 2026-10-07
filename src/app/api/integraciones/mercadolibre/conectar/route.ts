import { randomBytes } from "crypto";

import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/api-errors";
import { requireApiWriteSession } from "@/lib/api-auth";
import { getMercadoLibreAuthorizationUrl } from "@/lib/mercadolibre";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATE_COOKIE = "imc_meli_oauth_state";

export async function GET(request: NextRequest) {
  try {
    await requireApiWriteSession(request);
    const state = randomBytes(32).toString("base64url");
    const response = NextResponse.redirect(getMercadoLibreAuthorizationUrl(state));
    response.cookies.set(STATE_COOKIE, state, {
      httpOnly: true,
      maxAge: 600,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    return response;
  } catch (error) {
    return jsonError(error, "No se pudo iniciar la conexion con Mercado Libre.");
  }
}
