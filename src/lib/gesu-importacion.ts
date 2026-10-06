import { z } from "zod";

export const GESU_PRODUCT_MAPPINGS = {
  cod_unico: { csvHeader: "Codigo Unico", updateExisting: true },
  titulo: { csvHeader: "Descripcion", updateExisting: true },
  cod_barra: { csvHeader: "Codigo de Barras", updateExisting: true },
  stock: { csvHeader: "Stock", updateExisting: true },
  marca: { csvHeader: "Marca", updateExisting: false },
  subcategoria: { csvHeader: "Subcategoria", updateExisting: false },
  ubicacion: { csvHeader: "Ubicacion", updateExisting: false },
  codigo_pieza: { csvHeader: "", updateExisting: false },
  palabra_clave: { csvHeader: "", updateExisting: false },
  proveedor: { csvHeader: "Proveedor", updateExisting: true },
  codigo_proveedor: { csvHeader: "Codigo Proveedor", updateExisting: true },
  precio_lista_proveedor: { csvHeader: "Precio Lista Proveedor", updateExisting: true },
};
export const GESU_KIT_MAPPINGS = {
  codigo_kit: { csvHeader: "Codigo Kit" },
  nombre_kit: { csvHeader: "Nombre Kit" },
  cod_producto: { csvHeader: "Codigo Item" },
  cantidad: { csvHeader: "Cantidad" },
};

const value = z.union([z.string().max(2000), z.number().finite(), z.null()]);
const row = z.record(z.string().max(100), value).refine((r) => Object.keys(r).length <= 20, "Demasiadas columnas");
export const gesuRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("iniciar"), id: z.uuid(), fileName: z.string().trim().min(1).max(250), totalBatches: z.number().int().min(1).max(2000) }),
  z.object({ action: z.literal("lote"), id: z.uuid(), batch: z.number().int().min(0).max(1999), type: z.enum(["productos", "kits"]), rows: z.array(row).min(1).max(500) }),
  z.object({ action: z.literal("aplicar"), id: z.uuid() }),
]);
export type GesuImportResult = {
  productsImported: number; productsUpdated: number; kitsImported: number; kitsUpdated: number;
  deletedProducts: number; missingProviders: string[]; errors: string[];
};
