import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiWriteSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";
import { guardarCostoManualItem } from "@/lib/repos/costo-manual-items";
import { parseIdParam } from "@/lib/validators/catalogos";
import { encolarActualizacionesPrecioMercadoLibre } from "@/lib/mercadolibre";

const schema = z.object({
  importeOrigen: z.number().finite().min(0),
  codigoCotizacionEsperado: z.string().min(1).max(40),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireApiWriteSession(request);
  try {
    const { id } = await params;
    const idProducto = parseIdParam(id);
    const input = schema.parse(await request.json());
    const result = await guardarCostoManualItem({ ...input, idProducto, usuarioId: session.usuarioId });
    if (result.modificado) {
      try {
        await encolarActualizacionesPrecioMercadoLibre([idProducto], []);
      } catch (queueError) {
        console.error("[MERCADOLIBRE] No se pudieron encolar los precios del item:", queueError);
      }
    }
    return NextResponse.json(result);
  } catch (error: unknown) {
    return jsonError(error, "No se pudo guardar el costo manual");
  }
}
