import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { jsonError } from "@/lib/api-errors";
import { requireApiWriteSession } from "@/lib/api-auth";
import {
  encolarActualizacionesPrecioMercadoLibreDetallado,
  procesarActualizacionesPrecioMercadoLibre,
} from "@/lib/mercadolibre";
import { MAX_ITEMS_BUSQUEDA_MASIVA, obtenerItemsDeBusquedaMasiva, type FiltrosBusquedaMasiva } from "@/lib/seleccion-items";
import { puedeVerProductosInactivos } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const filtersSchema = z.object({
  search: z.string().optional(),
  searchSpecific: z.string().optional(),
  categoria: z.string().optional(),
  subcategoria: z.string().optional(),
  marca: z.string().optional(),
  proveedor: z.string().optional(),
  estado: z.enum(["ACTIVOS", "INACTIVOS", "TODOS"]).optional(),
  margenes: z.enum(["COMPLETOS", "FALTA_ALGUNO", "FALTA_MOSTRADOR", "FALTA_MECANICO", "FALTA_MERCADO_LIBRE"]).optional(),
});

const selectionSchema = z.object({
  productoIds: z.array(z.coerce.number().int().positive()).max(500).optional(),
  filtrosBusqueda: filtersSchema.optional(),
  incluirPausadas: z.boolean().optional(),
  limiteInmediato: z.coerce.number().int().min(1).max(50).optional(),
}).superRefine((value, context) => {
  if (!value.productoIds?.length && !value.filtrosBusqueda) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Selecciona al menos un item para actualizar." });
  }
  if (value.productoIds?.length && value.filtrosBusqueda) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "La seleccion debe ser por items o por busqueda, no ambas." });
  }
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiWriteSession(request);
    const payload = selectionSchema.parse(await request.json());

    let itemIds = [...new Set(payload.productoIds || [])];
    if (payload.filtrosBusqueda) {
      const filters: FiltrosBusquedaMasiva = {
        ...payload.filtrosBusqueda,
        estado: puedeVerProductosInactivos(session.rol, session.permisos)
          ? payload.filtrosBusqueda.estado
          : "ACTIVOS",
      };
      const selected = await obtenerItemsDeBusquedaMasiva(filters);
      if (selected.truncated) {
        return NextResponse.json({
          message: `La busqueda supera el maximo de ${MAX_ITEMS_BUSQUEDA_MASIVA.toLocaleString("es-AR")} items. Refina los filtros antes de actualizar Mercado Libre.`,
          totalCount: selected.totalCount,
          maxSelection: MAX_ITEMS_BUSQUEDA_MASIVA,
        }, { status: 422 });
      }
      itemIds = selected.itemIds;
    }

    if (!itemIds.length) return NextResponse.json({ message: "La seleccion no contiene items." }, { status: 422 });

    const queued = await encolarActualizacionesPrecioMercadoLibreDetallado(itemIds, [], {
      incluirPausadas: payload.incluirPausadas ?? false,
    });
    const limiteInmediato = payload.limiteInmediato ?? 50;
    const inmediato = await procesarActualizacionesPrecioMercadoLibre(
      limiteInmediato,
      undefined,
      queued.publicacionesIds.slice(0, limiteInmediato),
    );

    return NextResponse.json({
      itemsSeleccionados: itemIds.length,
      publicacionesEncoladas: queued.cantidad,
      ...inmediato,
      pendientesEnCola: Math.max(0, queued.cantidad - inmediato.procesadas),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error, "No se pudieron actualizar los precios seleccionados en Mercado Libre.");
  }
}
