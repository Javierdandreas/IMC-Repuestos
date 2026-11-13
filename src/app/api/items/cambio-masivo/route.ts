import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiWriteSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";
import { aplicarCambioMasivoItems } from "@/lib/repos/cambio-masivo-items";
import { obtenerItemsDeBusquedaMasiva } from "@/lib/seleccion-items";
import { puedeVerProductosInactivos } from "@/lib/permissions";

const schema = z.object({
  items: z.array(z.object({
    id: z.number().int().positive(),
    tipo: z.enum(["ITEM", "KIT"]),
  })).max(500).default([]),
  filtrosBusqueda: z.object({
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
  }).optional(),
  campo: z.enum(["CLASIFICACION", "MARCA", "PROVEEDOR", "UBICACION", "STOCK_MINIMO", "OBSERVACION", "PALABRAS_CLAVE", "PIEZA", "CRITERIO_COSTO"]),
  idCategoria: z.number().int().positive().optional(),
  idSubcategoria: z.number().int().positive().optional(),
  idMarca: z.number().int().positive().optional(),
  idProveedor: z.number().int().positive().optional(),
  idUbicacion: z.number().int().positive().optional(),
  idPieza: z.number().int().positive().optional(),
  criterioCosto: z.enum(["PROVEEDOR_UNICO", "MANUAL", "MENOR_PRECIO", "PROMEDIO_PRECIO", "MAYOR_PRECIO"]).optional(),
  stockMinimo: z.number().int().nonnegative().optional(),
  texto: z.string().max(5000).optional(),
});

export async function POST(request: NextRequest) {
  const session = await requireApiWriteSession(request);
  try {
    const payload = schema.parse(await request.json());
    const searchFilters = payload.filtrosBusqueda
      ? {
        ...payload.filtrosBusqueda,
        estado: puedeVerProductosInactivos(session.rol, session.permisos)
          && (payload.filtrosBusqueda.estado === "INACTIVOS" || payload.filtrosBusqueda.estado === "TODOS")
          ? payload.filtrosBusqueda.estado
          : "ACTIVOS" as const,
      }
      : null;
    const searchSelection = searchFilters
      ? await obtenerItemsDeBusquedaMasiva(searchFilters)
      : null;
    if (searchSelection?.truncated) {
      return NextResponse.json({ message: "La busqueda supera el limite de 30.000 resultados. Refina los filtros." }, { status: 422 });
    }
    const items = searchSelection
      ? searchSelection.itemIds.map((id) => ({ id, tipo: "ITEM" as const }))
      : payload.items;
    const result = await aplicarCambioMasivoItems({ ...payload, items, usuarioId: session.usuarioId });
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error, "No se pudo aplicar el cambio masivo");
  }
}
