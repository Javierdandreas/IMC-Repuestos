import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiWriteSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";
import { findExistingGesuCodes } from "@/lib/repos/importacion-gesu";

const requestSchema = z.object({
  type: z.enum(["productos", "kits"]),
  codes: z.array(z.string().max(100)).max(1000),
});

export async function POST(request: NextRequest) {
  try {
    await requireApiWriteSession(request);
    const body = requestSchema.parse(await request.json());
    const existingCodes = await findExistingGesuCodes(body.type, body.codes);
    return NextResponse.json({ existingCodes });
  } catch (error: unknown) {
    return jsonError(error, "No se pudo preparar la vista previa de GESU");
  }
}
