import { NextRequest, NextResponse } from "next/server";
import { AppError, jsonError } from "@/lib/api-errors";
import { requireApiReadSession, requireApiWriteSession } from "@/lib/api-auth";
import { withTransaction } from "@/lib/db-utils";
import { ESTADOS_STOCK_PROVEEDOR, type EstadoStockProveedor } from "@/lib/stock-proveedor";
import {
  getProveedorReglasColorStock,
  upsertProveedorReglasColorStock,
  type ReglaColorStockProveedor,
} from "@/lib/repos/proveedor-stock-colores";

type Params = Promise<{ id: string }>;

function normalizarColor(value: unknown) {
  const color = String(value ?? "").replace("#", "").trim().toUpperCase();
  if (color === "SIN_COLOR") return color;
  if (!color) return "SIN_COLOR";
  return color.length >= 6 ? color.slice(-6) : color;
}

export async function GET(request: NextRequest, { params }: { params: Params }) {
  try {
    await requireApiReadSession(request);
    const { id } = await params;
    return NextResponse.json(await getProveedorReglasColorStock(Number(id)));
  } catch (error) {
    return jsonError(error, "Error al obtener los colores de stock");
  }
}

export async function POST(request: NextRequest, { params }: { params: Params }) {
  try {
    await requireApiWriteSession(request);
    const { id } = await params;
    const idProveedor = Number(id);
    const body = await request.json();
    if (!Number.isInteger(idProveedor) || idProveedor <= 0 || !Array.isArray(body.reglas) || body.reglas.length > 30) {
      throw new AppError("La configuracion de colores no es valida", 400);
    }

    const byColor = new Map<string, ReglaColorStockProveedor>();
    for (const raw of body.reglas) {
      const color = normalizarColor(raw.color);
      const estado = raw.estado as EstadoStockProveedor;
      if ((color !== "SIN_COLOR" && !/^[A-F0-9]{6}$/.test(color)) || !ESTADOS_STOCK_PROVEEDOR.includes(estado)) {
        throw new AppError("Uno de los colores o estados no es valido", 400);
      }
      byColor.set(color, { color, estado, activo: raw.activo !== false });
    }

    await withTransaction(async (client) => {
      const provider = await client.query(`SELECT id FROM public.proveedores WHERE id = $1`, [idProveedor]);
      if (provider.rowCount === 0) throw new AppError("Proveedor no encontrado", 404);
      if (body.reemplazar === true) {
        await client.query(`DELETE FROM public.proveedor_stock_color_regla WHERE id_proveedor = $1`, [idProveedor]);
      }
      await upsertProveedorReglasColorStock(client, idProveedor, [...byColor.values()]);
    });

    return NextResponse.json({ success: true, reglas: await getProveedorReglasColorStock(idProveedor) });
  } catch (error) {
    return jsonError(error, "Error al guardar los colores de stock");
  }
}
