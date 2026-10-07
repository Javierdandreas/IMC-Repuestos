import { createHash, randomBytes } from "crypto";

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
    const codeVerifier = randomBytes(64).toString("base64url");
    const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
    const response = NextResponse.redirect(getMercadoLibreAuthorizationUrl(state, codeChallenge));
    response.cookies.set(STATE_COOKIE, Buffer.from(JSON.stringify({ state, codeVerifier })).toString("base64url"), {
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
