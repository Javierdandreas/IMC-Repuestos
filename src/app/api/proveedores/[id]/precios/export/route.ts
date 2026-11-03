import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";

import { AppError, jsonError } from "@/lib/api-errors";
import { requireApiReadSession } from "@/lib/api-auth";
import { getCostosBaseProveedorParaExportar } from "@/lib/repos/productos";

export const dynamic = "force-dynamic";

function slugArchivo(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase() || "PROVEEDOR";
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireApiReadSession(request);
    const { id } = await params;
    const idProveedor = Number(id);
    if (!Number.isInteger(idProveedor) || idProveedor <= 0) {
      throw new AppError("Proveedor invalido.", 400);
    }

    const data = await getCostosBaseProveedorParaExportar(idProveedor);
    if (!data.length) throw new AppError("El proveedor no tiene items asociados para exportar.", 404);

    const proveedor = data[0].proveedor;
    const rows = data.map((item) => ({
      "Codigo interno": item.codigo_interno,
      "Codigo de proveedor": item.codigo_proveedor,
      Proveedor: item.proveedor,
      "Costo base": item.costo_base,
    }));
    const csv = "\uFEFF" + Papa.unparse(rows, {
      columns: ["Codigo interno", "Codigo de proveedor", "Proveedor", "Costo base"],
      header: true,
      skipEmptyLines: true,
    });
    const date = new Date().toISOString().slice(0, 10);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="COSTOS-BASE-${slugArchivo(proveedor)}-${date}.csv"`,
      },
    });
  } catch (error) {
    return jsonError(error, "No se pudieron exportar los costos del proveedor.");
  }
}
