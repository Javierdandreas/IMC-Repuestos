import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-errors";
import { requireApiReadSession } from "@/lib/api-auth";
import { getItemsSinVinculoGesu } from "@/lib/repos/listado-items-sin-gesu";

export async function GET(request: NextRequest) {
  try {
    await requireApiReadSession(request);
    const params = request.nextUrl.searchParams;
    return NextResponse.json(await getItemsSinVinculoGesu({
      page: Number(params.get("page")) || 1,
      limit: Number(params.get("limit")) || 50,
      search: params.get("q") || "",
    }));
  } catch (error) {
    return jsonError(error, "No se pudo obtener el listado de items sin vinculo GESU.");
  }
}
