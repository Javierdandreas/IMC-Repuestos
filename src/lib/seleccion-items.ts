import {
  getItemsUnificadosListado,
  type FiltrosItemsUnificados,
  type ItemListadoUnificado,
} from "@/lib/repos/items-unificados";

export const MAX_ITEMS_BUSQUEDA_MASIVA = 30_000;

export type FiltrosBusquedaMasiva = Pick<
  FiltrosItemsUnificados,
  "search" | "searchSpecific" | "categoria" | "subcategoria" | "marca" | "proveedor" | "estado" | "margenes"
>;

export async function obtenerItemsDeBusquedaMasiva(filters: FiltrosBusquedaMasiva) {
  const result = await getItemsUnificadosListado(1, MAX_ITEMS_BUSQUEDA_MASIVA, filters);
  const items = result.data.filter((item): item is ItemListadoUnificado & { tipo: "ITEM" } => item.tipo === "ITEM");

  return {
    itemIds: items.map((item) => item.id),
    itemCount: items.length,
    truncated: result.totalCount > MAX_ITEMS_BUSQUEDA_MASIVA,
    totalCount: result.totalCount,
  };
}
