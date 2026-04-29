import { NextRequest, NextResponse } from "next/server";
import { OcrService } from "@/modules/presupuestos/services/ocr-service";
import { requireApiPermission } from "@/modules/auth/repos/api-auth";
import { jsonError } from "@/lib/api-errors";

export async function GET(request: NextRequest) {
  try {
    await requireApiPermission(request, "vehiculos.crear");
    const modelos = await OcrService.listModels();
    return NextResponse.json({ modelos });
  } catch (error: unknown) {
    return jsonError(error, "Error al listar modelos de Gemini");
  }
}
