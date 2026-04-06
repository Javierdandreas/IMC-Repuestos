import type { ProveedorProducto } from "@/interfaces/productos";
import { AppError } from "@/lib/api-errors";

type ProductoPayload = {
  cod_unico: string;
  descripcion: string;
  cod_barra?: string | null;
  stock?: number;
  id_pieza?: number | null;
  id_subcategoria: number | null;
  id_marca?: number | null;
  proveedores?: ProveedorProducto[];
};

function parseNullablePositiveInt(value: unknown, field: string) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) throw new AppError(`${field} inválido`, 400);
  return num;
}

export function validateProductoPayload(body: any): ProductoPayload {
  const cod_unico = String(body?.cod_unico ?? "").toUpperCase().trim();
  const descripcion = String(body?.descripcion ?? "").toUpperCase().trim();
  const cod_barraRaw = String(body?.cod_barra ?? "").trim();
  const stockNum = Number(body?.stock ?? 0);
  const id_subcategoria = parseNullablePositiveInt(body?.id_subcategoria, "La subcategoría");
  const id_pieza = parseNullablePositiveInt(body?.id_pieza, "La pieza");
  const id_marca = parseNullablePositiveInt(body?.id_marca, "La marca");

  if (!cod_unico) throw new AppError("El código único es obligatorio", 400);
  if (!descripcion) throw new AppError("La descripción es obligatoria", 400);
  if (!id_subcategoria) throw new AppError("La subcategoría es obligatoria", 400);
  if (!Number.isFinite(stockNum) || stockNum < 0) throw new AppError("El stock es inválido", 400);
  if (cod_barraRaw && !/^\d+$/.test(cod_barraRaw)) throw new AppError("El código de barra solo puede contener números", 400);

  const proveedoresInput = Array.isArray(body?.proveedores) ? body.proveedores : [];
  const proveedores = proveedoresInput.map((item: any) => ({
    id_proveedor: parseNullablePositiveInt(item?.id_proveedor, "El proveedor"),
    codigo_proveedor: String(item?.codigo_proveedor ?? "").toUpperCase().trim(),
  }));

  return {
    cod_unico,
    descripcion,
    cod_barra: cod_barraRaw || null,
    stock: stockNum,
    id_pieza,
    id_subcategoria,
    id_marca,
    proveedores,
  };
}
