import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx-js-style";
import { AppError, jsonError } from "@/lib/api-errors";
import { requireApiReadSession } from "@/lib/api-auth";
import { getCatalogoMaestroParaExportar, type CatalogoMaestroTipo } from "@/lib/repos/catalogos";

export const dynamic = "force-dynamic";

const TIPOS = new Set<CatalogoMaestroTipo>(["marcas", "categorias", "ubicaciones"]);

export async function GET(request: NextRequest) {
  try {
    await requireApiReadSession(request);
    const tipo = new URL(request.url).searchParams.get("tipo") as CatalogoMaestroTipo;
    if (!TIPOS.has(tipo)) throw new AppError("Catalogo maestro invalido.", 400);

    const rows = await getCatalogoMaestroParaExportar(tipo);
    const headers = tipo === "categorias" ? ["Categoria", "Subcategoria"] : [tipo === "marcas" ? "Marca" : "Ubicacion"];
    const sheet = rows.length ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([headers]);
    sheet["!cols"] = headers.map((header) => ({ wch: Math.max(header.length + 4, 24) }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, tipo === "categorias" ? "Categorias" : tipo === "marcas" ? "Marcas" : "Ubicaciones");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${tipo}_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  } catch (error) {
    return jsonError(error, "No se pudo exportar el catalogo maestro.");
  }
}
