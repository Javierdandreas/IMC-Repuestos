import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx-js-style";
import { requireApiReadSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";
import { exportarCatalogoChasis, type EstadoCompatibilidad } from "@/lib/repos/compatibilidades-mercadolibre";

const ESTADOS = new Set<EstadoCompatibilidad | "TODAS">(["PENDIENTE", "CONFIRMADA", "DESCARTADA", "TODAS"]);

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireApiReadSession(request);
    const idCuenta = Number(request.nextUrl.searchParams.get("idCuenta"));
    if (!Number.isInteger(idCuenta) || idCuenta <= 0) throw new Error("Selecciona una cuenta de Mercado Libre valida.");
    const rawEstado = request.nextUrl.searchParams.get("estado") || "PENDIENTE";
    const estado = ESTADOS.has(rawEstado as EstadoCompatibilidad | "TODAS") ? rawEstado as EstadoCompatibilidad | "TODAS" : "PENDIENTE";
    const rows = await exportarCatalogoChasis({ idCuenta, estado, search: request.nextUrl.searchParams.get("q") || "" });
    const worksheet = XLSX.utils.json_to_sheet(rows.map((row) => ({
      CHASIS: row.chasis || "",
      MARCA: row.marca || "",
      MODELO: row.modelo || "",
      MOTOR: row.motor || "",
      "AÑO": row.anio || "",
      CILINDRADA: row.cilindrada || "",
      PUBLICACION: row.titulo_publicacion || "",
      "PREGUNTA DEL CLIENTE": row.pregunta,
      "RESPUESTA HISTORICA": row.respuesta_historica || "",
    })));
    worksheet["!autofilter"] = { ref: worksheet["!ref"] || "A1:I1" };
    worksheet["!freeze"] = { xSplit: 0, ySplit: 1 };
    worksheet["!cols"] = [{ wch: 21 }, { wch: 20 }, { wch: 30 }, { wch: 24 }, { wch: 12 }, { wch: 16 }, { wch: 50 }, { wch: 70 }, { wch: 70 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Chasis");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="catalogo_chasis_${date}.xlsx"`,
      },
    });
  } catch (error) {
    return jsonError(error, "No se pudo exportar el catalogo de chasis.");
  }
}
