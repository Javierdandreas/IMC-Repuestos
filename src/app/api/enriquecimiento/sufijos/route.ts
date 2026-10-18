import { NextRequest, NextResponse } from "next/server";
import { getSufijosMarca, updateSufijosMarca } from "@/lib/repos/enriquecimiento";
import { requireApiSession, requireApiWriteSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";

export async function GET(request: NextRequest) {
  await requireApiSession(request);
  try {
    return NextResponse.json(await getSufijosMarca());
  } catch (error: unknown) {
    return jsonError(error, "No se pudieron obtener los sufijos de marca.");
  }
}

export async function PUT(request: NextRequest) {
  await requireApiWriteSession(request);
  try {
    const body = await request.json();
    if (!Array.isArray(body?.items)) throw new Error("Los cambios de sufijos no son validos.");
    await updateSufijosMarca(body.items);
    return NextResponse.json(await getSufijosMarca());
  } catch (error: unknown) {
    return jsonError(error, "No se pudieron guardar los sufijos de marca.");
  }
}
