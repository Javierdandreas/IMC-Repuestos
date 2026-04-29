import { NextRequest, NextResponse } from "next/server";
import { CatalogoService } from "@/modules/catalogos/services/catalogo-service";
import { requireApiPermission } from "@/modules/auth/repos/api-auth";
import { jsonError } from "@/lib/api-errors";
import { AppPermission } from "@/modules/auth/repos/permissions";

const ALLOWED_TABLES = ["marcas", "proveedores", "ubicaciones"] as const;
type AllowedTable = typeof ALLOWED_TABLES[number];

const TABLE_TO_PERMISSION_READ: Record<AllowedTable, AppPermission> = {
  marcas: "marcas.ver",
  proveedores: "proveedores.ver",
  ubicaciones: "ubicaciones.ver",
};

const TABLE_TO_PERMISSION_WRITE: Record<AllowedTable, AppPermission> = {
  marcas: "marcas.crear",
  proveedores: "proveedores.crear",
  ubicaciones: "ubicaciones.crear",
};

type Params = Promise<{ table: string }>;

export async function GET(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const { table } = await params;
    
    if (!ALLOWED_TABLES.includes(table as any)) {
      return NextResponse.json({ message: "Catálogo no encontrado" }, { status: 404 });
    }

    const t = table as AllowedTable;
    await requireApiPermission(request, TABLE_TO_PERMISSION_READ[t]);

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const result = await CatalogoService.getPaginated(t, page, limit);
    return NextResponse.json(result);
  } catch (error: any) {
    return jsonError(error, "No se pudo obtener el catálogo");
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const { table } = await params;

    if (!ALLOWED_TABLES.includes(table as any)) {
      return NextResponse.json({ message: "Catálogo no encontrado" }, { status: 404 });
    }

    const t = table as AllowedTable;
    await requireApiPermission(request, TABLE_TO_PERMISSION_WRITE[t]);

    const { descripcion } = await request.json();
    const result = await CatalogoService.create(t, descripcion);
    return NextResponse.json(result);
  } catch (error: any) {
    return jsonError(error, "No se pudo crear el registro");
  }
}
