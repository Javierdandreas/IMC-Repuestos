export const INVENTARIO_EXPORT_COLUMNS = [
  { key: "Ubicacion", label: "Ubicacion" },
  { key: "Codigo producto", label: "Codigo producto" },
  { key: "Producto", label: "Producto" },
  { key: "Tipo", label: "Tipo" },
  { key: "Serie", label: "Serie" },
  { key: "Estado", label: "Estado" },
  { key: "Canal", label: "Canal" },
  { key: "Cantidad", label: "Cantidad" },
  { key: "Ultimo movimiento", label: "Ultimo movimiento" },
  { key: "Observacion movimiento", label: "Observacion movimiento" },
  { key: "Fecha ultimo movimiento", label: "Fecha ultimo movimiento" },
] as const;

export type InventarioExportColumnKey = (typeof INVENTARIO_EXPORT_COLUMNS)[number]["key"];

const VALID_COLUMNS = new Set<string>(INVENTARIO_EXPORT_COLUMNS.map((column) => column.key));

export function parseInventarioExportColumns(value: string | null): InventarioExportColumnKey[] {
  if (!value) return INVENTARIO_EXPORT_COLUMNS.map((column) => column.key);

  const selected = value
    .split(",")
    .map((column) => column.trim())
    .filter((column): column is InventarioExportColumnKey => VALID_COLUMNS.has(column));

  return selected.length > 0 ? selected : INVENTARIO_EXPORT_COLUMNS.map((column) => column.key);
}

export function pickInventarioExportColumns(
  rows: Record<string, unknown>[],
  columns: InventarioExportColumnKey[]
) {
  return rows.map((row) => {
    const output: Record<string, unknown> = {};
    columns.forEach((column) => {
      output[column] = row[column] ?? "";
    });
    return output;
  });
}
