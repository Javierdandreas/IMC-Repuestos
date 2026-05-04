import { NextResponse } from "next/server";
import { PiezaService } from "@/modules/piezas/services/pieza-service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "csv";
    const columns = searchParams.get("columns")?.split(",") || [];

    const result = await PiezaService.exportPiezas(format, columns);

    return new NextResponse(result.content, {
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename=${result.filename}`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
