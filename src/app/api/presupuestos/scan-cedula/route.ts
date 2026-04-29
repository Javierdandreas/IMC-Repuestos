import { NextRequest, NextResponse } from "next/server";
import { OcrService } from "@/modules/presupuestos/services/ocr-service";
import { requireApiPermission } from "@/modules/auth/repos/api-auth";
import { jsonError } from "@/lib/api-errors";

export const maxDuration = 60; // Permite a Vercel esperar hasta 60 segundos

export async function POST(request: NextRequest) {
  try {
    await requireApiPermission(request, "vehiculos.crear");

    const formData = await request.formData();
    const imageFile = formData.get("image") as File;

    if (!imageFile) {
      return NextResponse.json({ error: "No se recibiÃ³ ninguna imagen." }, { status: 400 });
    }

    const result = await OcrService.scanCedula(imageFile);

    return NextResponse.json(result);

  } catch (error: unknown) {
    return jsonError(error, "Error al escanear la cÃ©dula");
  }
}
