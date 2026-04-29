import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerSupabaseClient } from "@/modules/auth/repos/auth";
import { AuthService } from "@/modules/auth/services/auth-service";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  const supabase = createRouteHandlerSupabaseClient(request, response);

  await AuthService.logout(supabase);
  
  return response;
}
