import { NextRequest, NextResponse } from "next/server";
import { jsonError, AppError } from "@/lib/api-errors";
import { requireApiReadSession, requireApiWriteSession } from "@/lib/api-auth";
import { withTransaction } from "@/lib/db-utils";
import { recalcularCostosProveedorProductos } from "@/lib/costos-proveedor";
import { recalcularPreciosAutomaticos } from "@/lib/precios-automaticos";
import {
  getProveedorReglasCosto,
  replaceProveedorReglasCosto,
} from "@/lib/repos/proveedor-reglas-costo";
import {
  type ReglaCostoProveedor,
  validarReglaCostoProveedor,
} from "@/lib/reglas-costo-proveedor";

type Params = Promise<{ id: string }>;

export async function GET(request: NextRequest, { params }: { params: Params }) {
  try {
    await requireApiReadSession(request);
    const { id } = await params;
    return NextResponse.json(await getProveedorReglasCosto(Number(id)));
  } catch (error) {
    return jsonError(error, "Error al obtener las capas de costo");
  }
}

export async function POST(request: NextRequest, { params }: { params: Params }) {
  try {
    await requireApiWriteSession(request);
    const { id } = await params;
    const idProveedor = Number(id);
    if (!Number.isInteger(idProveedor) || idProveedor <= 0) throw new AppError("Proveedor invalido", 400);

    const body = await request.json();
    if (!Array.isArray(body.reglas) || body.reglas.length > 100) {
      throw new AppError("Las capas de costo no son validas", 400);
    }

    const reglas = body.reglas.map((raw: Partial<ReglaCostoProveedor>, index: number): ReglaCostoProveedor => {
      const alcance = raw.alcance === "MARCA" ? "MARCA" : "GENERAL";
      const marcasRaw = Array.isArray(raw.id_marcas) ? raw.id_marcas : [raw.id_marca];
      const idMarcas = [...new Set(
        marcasRaw
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id) && id > 0),
      )];
      if (alcance === "MARCA" && idMarcas.length > 1) {
        throw new AppError("Cada capa por marca solo puede tener una marca.", 400);
      }
      const condicionTipo = raw.condicion_tipo === "STOCK_TEXTO" ? "STOCK_TEXTO" : "SIEMPRE";

      return {
        nombre: String(raw.nombre ?? "").trim(),
        alcance,
        id_marca: alcance === "MARCA" ? idMarcas[0] ?? null : null,
        id_marcas: alcance === "MARCA" ? idMarcas.slice(0, 1) : [],
        tipo_ajuste: raw.tipo_ajuste as ReglaCostoProveedor["tipo_ajuste"],
        valor: Number(raw.valor),
        orden: index,
        activo: raw.activo !== false,
        condicion_tipo: condicionTipo,
        condicion_operador: "CONTIENE",
        condicion_valor: condicionTipo === "STOCK_TEXTO"
          ? String(raw.condicion_valor ?? "").trim()
          : null,
      };
    });

    for (const regla of reglas) {
      const validationError = validarReglaCostoProveedor(regla);
      if (validationError) throw new AppError(validationError, 400);
    }

    const result = await withTransaction(async (client) => {
      const provider = await client.query(`SELECT id FROM public.proveedores WHERE id = $1`, [idProveedor]);
      if (provider.rowCount === 0) throw new AppError("Proveedor no encontrado", 404);

      await replaceProveedorReglasCosto(client, idProveedor, reglas);
      const productIds = await recalcularCostosProveedorProductos(client, { idProveedor });
      const preciosRecalculados = await recalcularPreciosAutomaticos(client, productIds);
      return { productosAfectados: productIds.length, preciosRecalculados };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return jsonError(error, "Error al guardar las capas de costo");
  }
}
