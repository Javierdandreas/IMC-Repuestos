import type { CreateImportacionInput } from "@/interfaces/importaciones";
import { normalizarStockProveedor, normalizarStockProveedorPorColor } from "@/lib/stock-proveedor";

type RawImportItem = CreateImportacionInput["items"][number];

export function normalizarItemsImportacionProveedor(items: RawImportItem[]) {
  return items.map((item, index) => {
    const parsedPrice = item.precio_lista === null || item.precio_lista === undefined
      ? null
      : Number(item.precio_lista);
    const stock = item.stock_fuente === "COLOR_FILA"
      ? normalizarStockProveedorPorColor(item.stock_color, item.stock_color_estado)
      : normalizarStockProveedor(item.stock_original);

    return {
      fila: Number(item.fila || index + 2),
      proveedor_archivo: String(item.proveedor_archivo ?? "").trim(),
      codigo_proveedor: String(item.codigo_proveedor ?? "").trim().toUpperCase(),
      precio_lista: Number.isFinite(parsedPrice) ? parsedPrice : null,
      precio_original: String(item.precio_original ?? item.precio_lista ?? "").trim(),
      stock_original: stock.original || null,
      stock_estado: stock.estado,
      stock_cantidad: stock.cantidad,
    };
  });
}
