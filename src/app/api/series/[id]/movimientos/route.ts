import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";
import { getSerieMovimientos } from "@/lib/repos/series";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, { params }: Params) {
  await requireApiSession(request);

  try {
    const { id } = await params;
    const idSerie = Number(id);

    if (!Number.isInteger(idSerie) || idSerie <= 0) {
      return NextResponse.json({ message: "Serie invalida" }, { status: 400 });
    }

    const movimientos = await getSerieMovimientos(idSerie);
    return NextResponse.json({ movimientos });
  } catch (error: unknown) {
    return jsonError(error, "No se pudo cargar el historial de la serie");
  }
}
