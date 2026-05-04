import { NextResponse } from "next/server";
import { KitService } from "@/modules/kits/services/kit-service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "csv";

    const result = await KitService.exportKits(format);

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
