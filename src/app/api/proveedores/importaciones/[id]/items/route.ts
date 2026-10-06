import { NextRequest, NextResponse } from "next/server";

import { requireApiReadSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";
import { getImportacionItems } from "@/lib/repos/proveedor-importaciones";

type Params = Promise<{ id: string }>;

export async function GET(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    await requireApiReadSession(request);

    const { id } = await params;
    const importacionId = parseInt(id, 10);

    if (Number.isNaN(importacionId)) {
      return NextResponse.json({ error: "ID de importacion invalido" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page") || 1);
    const limit = Number(searchParams.get("limit") || 50);
    return NextResponse.json(await getImportacionItems(importacionId, page, limit));
  } catch (error: any) {
    return jsonError(error, "Error al obtener detalle de importacion");
  }
}

