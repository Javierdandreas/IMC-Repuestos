import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiWriteSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";
import { ocultarProductosConvertidosEnKit } from "@/lib/repos/importacion-gesu";

const requestSchema = z.object({
  codes: z.array(z.string().max(100)).max(1000),
});

export async function POST(request: NextRequest) {
  try {
    await requireApiWriteSession(request);
    const body = requestSchema.parse(await request.json());
    const hiddenCodes = await ocultarProductosConvertidosEnKit(body.codes);
    return NextResponse.json({ hiddenCodes });
  } catch (error: unknown) {
    return jsonError(error, "No se pudieron ocultar los productos convertidos en kits");
  }
}
