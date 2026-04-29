import { NextRequest, NextResponse } from "next/server";
import { ProductService } from "@/modules/productos/services/product-service";
import { requireApiPermission } from "@/modules/auth/repos/api-auth";
import { jsonError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireApiPermission(req, "productos.exportar");

    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "csv";
    const columns = searchParams.get("columns") || undefined;
    
    const filters = {
      search: searchParams.get("search") || undefined,
      searchSpecific: searchParams.get("searchSpecific") || undefined,
      categoria: searchParams.get("categoria") || undefined,
      subcategoria: searchParams.get("subcategoria") || undefined,
      marca: searchParams.get("marca") || undefined,
      proveedor: searchParams.get("proveedor") || undefined,
    };

    const result = await ProductService.exportProducts(filters, format, columns);

    return new NextResponse(result.content, {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${result.filename}"`,
      },
    });
  } catch (error: any) {
    console.error("âŒ Error en exportaciÃ³n:", error);
    return jsonError(error, "Error al exportar productos");
  }
}
