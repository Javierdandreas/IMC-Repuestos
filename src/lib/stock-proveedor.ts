export const ESTADOS_STOCK_PROVEEDOR = ["DISPONIBLE", "PROXIMO_INGRESO", "SIN_STOCK", "DESCONOCIDO"] as const;

export type EstadoStockProveedor = typeof ESTADOS_STOCK_PROVEEDOR[number];

export type StockProveedorNormalizado = {
  original: string;
  estado: EstadoStockProveedor;
  cantidad: number | null;
};

function normalizarTexto(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function parseCantidad(value: string): number | null {
  let clean = value.replace(/[^0-9,.-]/g, "");
  if (!clean || clean === "-" || clean === "," || clean === ".") return null;

  const lastComma = clean.lastIndexOf(",");
  const lastDot = clean.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    clean = lastComma > lastDot
      ? clean.replace(/\./g, "").replace(",", ".")
      : clean.replace(/,/g, "");
  } else if (lastComma >= 0) {
    clean = clean.replace(",", ".");
  }

  const parsed = Number(clean);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function normalizarStockProveedor(value: unknown): StockProveedorNormalizado {
  const original = String(value ?? "").trim();
  const texto = normalizarTexto(original);

  if (!texto) return { original: "", estado: "DESCONOCIDO", cantidad: null };

  if (/\b(SIN STOCK|AGOTADO|NO DISPONIBLE|NO HAY|SIN EXISTENCIA)\b/.test(texto)) {
    return { original, estado: "SIN_STOCK", cantidad: 0 };
  }

  const cantidad = parseCantidad(original);
  if (cantidad !== null) {
    return {
      original,
      estado: cantidad > 0 ? "DISPONIBLE" : "SIN_STOCK",
      cantidad,
    };
  }

  if (/\b(DISPONIBLE|EN STOCK|STOCK|SI|OK|HAY)\b/.test(texto)) {
    return { original, estado: "DISPONIBLE", cantidad: null };
  }

  return { original, estado: "DESCONOCIDO", cantidad: null };
}

function normalizarColorExcel(value: unknown) {
  const color = String(value ?? "")
    .replace("#", "")
    .trim()
    .toUpperCase();

  return color.length >= 6 ? color.slice(-6) : color;
}

export function normalizarStockProveedorPorColor(
  color: unknown,
  estadoAsignado?: EstadoStockProveedor | null
): StockProveedorNormalizado {
  const colorNormalizado = normalizarColorExcel(color);

  if (estadoAsignado && ESTADOS_STOCK_PROVEEDOR.includes(estadoAsignado)) {
    return {
      original: colorNormalizado ? `Color #${colorNormalizado}` : "Sin color (blanco)",
      estado: estadoAsignado,
      cantidad: estadoAsignado === "SIN_STOCK" ? 0 : null,
    };
  }

  if (colorNormalizado === "C6EFCE") {
    return { original: "Color verde (#C6EFCE)", estado: "DISPONIBLE", cantidad: null };
  }

  if (colorNormalizado === "FFF2CC") {
    return { original: "Color amarillo (#FFF2CC)", estado: "PROXIMO_INGRESO", cantidad: null };
  }

  if (["", "FFFFFF", "F3F6F8"].includes(colorNormalizado)) {
    return {
      original: colorNormalizado ? `Color blanco (#${colorNormalizado})` : "Sin color (blanco)",
      estado: "SIN_STOCK",
      cantidad: 0,
    };
  }

  return {
    original: `Color no reconocido (#${colorNormalizado})`,
    estado: "DESCONOCIDO",
    cantidad: null,
  };
}

export function labelEstadoStockProveedor(estado?: string | null, cantidad?: number | null) {
  if (estado === "DISPONIBLE") {
    return cantidad !== null && cantidad !== undefined
      ? `Disponible: ${Number(cantidad).toLocaleString("es-AR")}`
      : "Disponible";
  }
  if (estado === "PROXIMO_INGRESO") return "Proximo ingreso";
  if (estado === "SIN_STOCK") return "Sin stock";
  return "Desconocido";
}
