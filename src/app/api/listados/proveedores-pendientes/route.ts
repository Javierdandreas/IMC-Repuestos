import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiReadSession, requireApiWriteSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";
import {
  asignarProveedorAItemsSinProveedor,
  actualizarCodigoProveedorPendiente,
  getItemsProveedoresPendientes,
} from "@/lib/repos/listado-proveedores-pendientes";

const tipoSchema = z.enum(["SIN_PROVEEDOR", "SIN_CODIGO"]);
const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("ASIGNAR_PROVEEDOR"), productIds: z.array(z.number().int().positive()).min(1).max(500), idProveedor: z.number().int().positive() }),
  z.object({ action: z.literal("ASIGNAR_CODIGO"), idProducto: z.number().int().positive(), idProveedor: z.number().int().positive(), codigoProveedor: z.string().trim().min(1).max(100) }),
]);

export async function GET(request: NextRequest) {
  try {
    await requireApiReadSession(request);
    const params = request.nextUrl.searchParams;
    return NextResponse.json(await getItemsProveedoresPendientes({
      tipo: tipoSchema.parse(params.get("tipo") || "SIN_PROVEEDOR"),
      page: Number(params.get("page")) || 1,
      limit: Number(params.get("limit")) || 50,
      search: params.get("q") || "",
    }));
  } catch (error) {
    return jsonError(error, "No se pudo obtener el listado de proveedores pendientes.");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireApiWriteSession(request);
    const body = patchSchema.parse(await request.json());
    if (body.action === "ASIGNAR_PROVEEDOR") {
      return NextResponse.json(await asignarProveedorAItemsSinProveedor(body.productIds, body.idProveedor, session.usuarioId));
    }
    return NextResponse.json(await actualizarCodigoProveedorPendiente(body.idProducto, body.idProveedor, body.codigoProveedor, session.usuarioId));
  } catch (error) {
    return jsonError(error, "No se pudo actualizar el proveedor pendiente.");
  }
}
