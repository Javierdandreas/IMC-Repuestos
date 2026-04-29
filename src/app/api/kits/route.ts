import { NextRequest, NextResponse } from "next/server";
import { KitService } from "@/modules/kits/services/kit-service";
import { requireApiPermission } from "@/modules/auth/repos/api-auth";
import { jsonError } from "@/lib/api-errors";

export async function GET(request: NextRequest) {
  try {
    await requireApiPermission(request, "kits.ver");
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page")) || 1;
    const limit = Number(searchParams.get("limit")) || 50;
    const search = searchParams.get("search") || undefined;

    const result = await KitService.list(page, limit, search);
    return NextResponse.json(result);
  } catch (error: unknown) {
    return jsonError(error, "No se pudieron obtener los kits");
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireApiPermission(request, "kits.crear");
    const body = await request.json();
    const newKit = await KitService.create(body);
    return NextResponse.json(newKit);
  } catch (error: unknown) {
    return jsonError(error, "No se pudo crear el kit");
  }
}
