import { NextRequest, NextResponse } from "next/server";
import { requireApiSession, requireApiWriteSession } from "@/modules/auth/repos/api-auth";
import { getSeriesPorProducto, createSeries } from "@/modules/series/repos/series";
import { validateCreateSeriesPayload } from "@/modules/series/validators/series";
import { jsonError } from "@/lib/api-errors";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> } // Cambio según requerimientos NEXT 15
) {
  await requireApiSession(request);
  try {
    // Manejo seguro para Next.js 15: los params son Promise<{ id: string }>
    const resolvedParams = await params;
    const idProducto = Number(resolvedParams.id);
    
    if (isNaN(idProducto) || idProducto <= 0) {
      return NextResponse.json({ message: "ID de producto inválido" }, { status: 400 });
    }

    const series = await getSeriesPorProducto(idProducto);
    return NextResponse.json(series);
  } catch (error: unknown) {
    return jsonError(error, "No se pudieron obtener las series del producto");
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Aseguramos que sea una sesión con permisos altos que puede escribir
  const session = await requireApiWriteSession(request);
  try {
    const resolvedParams = await params;
    const idProducto = Number(resolvedParams.id);

    if (isNaN(idProducto) || idProducto <= 0) {
      return NextResponse.json({ message: "ID de producto inválido" }, { status: 400 });
    }

    const body = await request.json();
    
    // Validar el payload, forzando idProducto en el validación si queremos,
    // o integrando los ids en el body validado.
    const payload = validateCreateSeriesPayload({
      ...body,
      id_producto: idProducto,
    });

    const nuevasSeries = await createSeries(idProducto, payload.numeros_serie, session.usuarioId);

    return NextResponse.json(nuevasSeries, { status: 201 });
  } catch (error: unknown) {
    return jsonError(error, "No se pudo registrar la serie para el producto");
  }
}
