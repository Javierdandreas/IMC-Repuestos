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

    const items = await getImportacionItems(importacionId);
    return NextResponse.json(items);
  } catch (error: any) {
    return jsonError(error, "Error al obtener detalle de importacion");
  }
}

