import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireApiReadSession, requireApiWriteSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";
import {
  contarActualizacionesPendientesMercadoLibre,
  encolarActualizacionesPrecioMercadoLibrePorPublicacion,
  procesarActualizacionesPrecioMercadoLibre,
} from "@/lib/mercadolibre";
import {
  getActualizacionesMercadoLibreImportacion,
  marcarActualizacionesMercadoLibreImportacionEnCola,
  sincronizarActualizacionesMercadoLibreImportacion,
} from "@/lib/repos/proveedor-importaciones";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Params = Promise<{ id: string }>;

const bodySchema = z.object({
  actualizacionIds: z.array(z.coerce.number().int().positive()).max(30_000).optional(),
  todosPendientes: z.boolean().optional(),
  publicacionesIds: z.array(z.coerce.number().int().positive()).max(30_000).optional(),
  recargoPorcentaje: z.coerce.number().min(0).max(1_000).nullable().optional(),
}).superRefine((value, context) => {
  if (!value.publicacionesIds?.length && !value.todosPendientes && !value.actualizacionIds?.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Selecciona al menos una publicacion." });
  }
});

function importacionId(value: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new Error("ID de importacion invalido.");
  return id;
}

export async function GET(request: NextRequest, { params }: { params: Params }) {
  try {
    await requireApiReadSession(request);
    const { id } = await params;
    return NextResponse.json(await getActualizacionesMercadoLibreImportacion(importacionId(id)), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error, "No se pudieron obtener las publicaciones afectadas por esta importacion.");
  }
}

export async function POST(request: NextRequest, { params }: { params: Params }) {
  try {
    await requireApiWriteSession(request);
    const { id } = await params;
    const idImportacion = importacionId(id);
    const payload = bodySchema.parse(await request.json());

    let publicacionesIds = [...new Set(payload.publicacionesIds || [])];
    if (!publicacionesIds.length) {
      const detalle = await getActualizacionesMercadoLibreImportacion(idImportacion);
      const idsSeleccionados = payload.todosPendientes
        ? detalle.data.filter((row) => row.estado === "PENDIENTE" || row.estado === "EN_COLA" || row.estado === "ERROR").map((row) => row.id)
        : [...new Set(payload.actualizacionIds || [])];
      publicacionesIds = await marcarActualizacionesMercadoLibreImportacionEnCola(idImportacion, idsSeleccionados);
      const encoladas = await encolarActualizacionesPrecioMercadoLibrePorPublicacion(publicacionesIds, payload.recargoPorcentaje);
      publicacionesIds = encoladas.publicacionesIds;
    }

    if (!publicacionesIds.length) {
      return NextResponse.json({ publicacionesIds: [], procesadas: 0, actualizadas: 0, errores: 0, pendientesEnCola: 0 }, { headers: { "Cache-Control": "no-store" } });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (event: Record<string, unknown>) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        void (async () => {
          try {
            send({ tipo: "INICIO", publicacionesIds, publicacionesEncoladas: publicacionesIds.length });
            const resultado = await procesarActualizacionesPrecioMercadoLibre(
              100,
              undefined,
              publicacionesIds,
              (progress) => send({ tipo: "PROGRESO", ...progress }),
            );
            await sincronizarActualizacionesMercadoLibreImportacion(idImportacion, publicacionesIds);
            send({
              tipo: "FINAL",
              publicacionesIds,
              publicacionesEncoladas: publicacionesIds.length,
              ...resultado,
              pendientesEnCola: await contarActualizacionesPendientesMercadoLibre(publicacionesIds),
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : "No se pudieron actualizar las publicaciones de Mercado Libre.";
            send({ tipo: "ERROR", message });
          } finally {
            controller.close();
          }
        })();
      },
    });
    return new NextResponse(stream, { headers: { "Cache-Control": "no-store", "Content-Type": "application/x-ndjson; charset=utf-8" } });
  } catch (error) {
    return jsonError(error, "No se pudieron actualizar las publicaciones de Mercado Libre.");
  }
}
