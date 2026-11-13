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
  criterioCosto: z.enum(["PROVEEDOR_UNICO", "MANUAL", "MENOR_PRECIO", "PROMEDIO_PRECIO", "MAYOR_PRECIO"]).optional(),
  mercadoLibre: z.enum(["PUBLICADOS", "SIN_PUBLICAR"]).optional(),
});

const selectionSchema = z.object({
  productoIds: z.array(z.coerce.number().int().positive()).max(500).optional(),
  kitIds: z.array(z.coerce.number().int().positive()).max(500).optional(),
  filtrosBusqueda: filtersSchema.optional(),
  incluirPausadas: z.boolean().optional(),
  modo: z.enum(["PRECIOS", "STOCK", "STOCK_Y_PRECIOS"]).optional(),
  recargoPorcentaje: z.coerce.number().min(0).max(1_000).optional(),
  limiteInmediato: z.coerce.number().int().min(1).max(50).optional(),
}).superRefine((value, context) => {
  const hasExplicitSelection = Boolean(value.productoIds?.length || value.kitIds?.length);
  if (!hasExplicitSelection && !value.filtrosBusqueda) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Selecciona al menos un item para actualizar." });
  }
  if (hasExplicitSelection && value.filtrosBusqueda) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "La seleccion debe ser por items o por busqueda, no ambas." });
  }
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiWriteSession(request);
    const payload = selectionSchema.parse(await request.json());

    let itemIds = [...new Set(payload.productoIds || [])];
    const kitIds = [...new Set(payload.kitIds || [])];
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

    if (!itemIds.length && !kitIds.length) return NextResponse.json({ message: "La seleccion no contiene items o kits." }, { status: 422 });

    const modo = payload.modo ?? "PRECIOS";
    const actualizarPrecio = modo !== "STOCK";
    const actualizarStock = modo !== "PRECIOS";

    const queued = await encolarActualizacionesPrecioMercadoLibreDetallado(itemIds, kitIds, {
      incluirPausadas: payload.incluirPausadas ?? false,
      actualizarPrecio,
      actualizarStock,
      recargoPorcentaje: payload.recargoPorcentaje ?? 0,
      incluirKitsAfectados: false,
    });
    if (!queued.cantidad) {
      return NextResponse.json({
        itemsSeleccionados: itemIds.length,
        kitsSeleccionados: kitIds.length,
        publicacionesEncoladas: 0,
        procesadas: 0,
        actualizadas: 0,
        errores: 0,
        pendientesEnCola: 0,
      }, { headers: { "Cache-Control": "no-store" } });
    }

    const limiteInmediato = payload.limiteInmediato ?? 50;
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (event: Record<string, unknown>) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        void (async () => {
          try {
            send({
              tipo: "INICIO",
              itemsSeleccionados: itemIds.length,
              kitsSeleccionados: kitIds.length,
              publicacionesEncoladas: queued.cantidad,
            });
            const inmediato = await procesarActualizacionesPrecioMercadoLibre(
              limiteInmediato,
              undefined,
              queued.publicacionesIds.slice(0, limiteInmediato),
              (progress) => send({ tipo: "PROGRESO", ...progress }),
            );
            send({
              tipo: "FINAL",
              itemsSeleccionados: itemIds.length,
              kitsSeleccionados: kitIds.length,
              publicacionesEncoladas: queued.cantidad,
              ...inmediato,
              pendientesEnCola: Math.max(0, queued.cantidad - inmediato.procesadas),
            });
          } catch (streamError) {
            const message = streamError instanceof Error ? streamError.message : "No se pudieron actualizar las publicaciones seleccionadas en Mercado Libre.";
            send({ tipo: "ERROR", message });
          } finally {
            controller.close();
          }
        })();
      },
    });

    return new NextResponse(stream, {
      headers: { "Cache-Control": "no-store", "Content-Type": "application/x-ndjson; charset=utf-8" },
    });
  } catch (error) {
    return jsonError(error, "No se pudieron actualizar las publicaciones seleccionadas en Mercado Libre.");
  }
}
