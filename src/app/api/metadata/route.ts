import { NextRequest, NextResponse } from "next/server";
import { ProductService } from "@/modules/productos/services/product-service";
import { requireApiPermission } from "@/modules/auth/repos/api-auth";
import { jsonError } from "@/lib/api-errors";

export async function GET(request: NextRequest) {
  try {
    await requireApiPermission(request, "productos.ver");
    const meta = await ProductService.getMetadata();
    return NextResponse.json(meta);
  } catch (error: any) {
    return jsonError(error, "Error al obtener metadatos");
  }
}
