import { NextRequest } from "next/server";
import { getSessionCookieName, verifySessionToken } from "@/lib/auth";
import { AppError } from "@/lib/api-errors";

export async function requireApiSession(request: NextRequest) {
  const token = request.cookies.get(getSessionCookieName())?.value;
  const session = await verifySessionToken(token);

  if (!session) {
    throw new AppError("No autorizado", 401);
  }

  return session;
}
