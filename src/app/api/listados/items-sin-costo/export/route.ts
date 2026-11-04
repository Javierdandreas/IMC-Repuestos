import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx-js-style";
import { requireApiReadSession } from "@/lib/api-auth";
import { jsonError } from "@/lib/api-errors";
import { query } from "@/lib/db-utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireApiReadSession(request);
    const { rows } = await query<{
      codigo: string;
      descripcion: string;
      marca: string | null;
      categoria: string | null;
      subcategoria: string | null;
      criterio_costo: string;
      costo_base: number | null;
      diagnostico: string;
      proveedores: string | null;
    }>(`
      WITH tipo_costo AS (
        SELECT id FROM public.tipo_precio
        WHERE upper(trim(descripcion)) = 'PRECIO COSTO'
        ORDER BY id
        LIMIT 1
      ), costo_base AS (
        SELECT DISTINCT ON (precio.id_producto)
          precio.id_producto,
          precio.precio::float AS costo
        FROM public.producto_precio precio
        INNER JOIN tipo_costo ON tipo_costo.id = precio.id_tipo_precio
        ORDER BY precio.id_producto, precio.id DESC
      ), proveedores AS (
        SELECT
          asociacion.id_producto,
          COUNT(*)::int AS cantidad,
          COUNT(*) FILTER (WHERE NULLIF(trim(asociacion.codigo_proveedor), '') IS NULL)::int AS sin_codigo,
          COUNT(*) FILTER (WHERE COALESCE(asociacion.costo_actual, asociacion.precio_lista_actual) > 0)::int AS con_costo,
          STRING_AGG(
            proveedor.descripcion || ' [Codigo: ' || COALESCE(NULLIF(trim(asociacion.codigo_proveedor), ''), 'S/C') ||
            '; Lista: ' || COALESCE(asociacion.precio_lista_actual::text, '-') ||
            '; Neto: ' || COALESCE(asociacion.costo_actual::text, '-') || ']',
            ' | ' ORDER BY proveedor.descripcion
          ) AS detalle
        FROM public.producto_proveedor asociacion
        INNER JOIN public.proveedores proveedor ON proveedor.id = asociacion.id_proveedor
        GROUP BY asociacion.id_producto
      )
      SELECT
        p.cod_unico AS codigo,
        p.descripcion,
        marca.descripcion AS marca,
        categoria.descripcion AS categoria,
        subcategoria.descripcion AS subcategoria,
        p.criterio_costo,
        costo_base.costo AS costo_base,
        CASE
          WHEN COALESCE(proveedores.cantidad, 0) = 0 THEN 'Sin proveedor vinculado.'
          WHEN COALESCE(proveedores.con_costo, 0) > 0 THEN 'Tiene costo de proveedor: revisar el criterio o los cambios pendientes de aprobacion.'
          WHEN COALESCE(proveedores.sin_codigo, 0) > 0 THEN 'Hay proveedor vinculado sin codigo de proveedor.'
          ELSE 'Los proveedores vinculados no tienen una lista o costo neto valido.'
        END AS diagnostico,
        proveedores.detalle AS proveedores
      FROM public.productos p
      LEFT JOIN costo_base ON costo_base.id_producto = p.id
      LEFT JOIN proveedores ON proveedores.id_producto = p.id
      LEFT JOIN public.marcas marca ON marca.id = p.id_marca
      LEFT JOIN public.subcategoria subcategoria ON subcategoria.id = p.id_subcategoria
      LEFT JOIN public.categoria categoria ON categoria.id = subcategoria.id_categoria
      WHERE COALESCE(costo_base.costo, 0) <= 0
      ORDER BY categoria.descripcion NULLS LAST, subcategoria.descripcion NULLS LAST, marca.descripcion NULLS LAST, p.cod_unico
    `);

    const data = rows.map((item) => ({
      Codigo: item.codigo,
      Descripcion: item.descripcion,
      Marca: item.marca ?? "",
      Categoria: item.categoria ?? "",
      Subcategoria: item.subcategoria ?? "",
      "Criterio de costo": item.criterio_costo,
      "Costo base": item.costo_base ?? 0,
      Diagnostico: item.diagnostico,
      "Proveedores vinculados": item.proveedores ?? "Sin proveedores vinculados",
    }));
    const headers = ["Codigo", "Descripcion", "Marca", "Categoria", "Subcategoria", "Criterio de costo", "Costo base", "Diagnostico", "Proveedores vinculados"];
    const worksheet = data.length ? XLSX.utils.json_to_sheet(data) : XLSX.utils.aoa_to_sheet([headers]);
    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
    for (let column = range.s.c; column <= range.e.c; column += 1) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: 0, c: column })];
      if (cell) cell.s = { fill: { fgColor: { rgb: "B45309" } }, font: { bold: true, color: { rgb: "FFFFFF" } } };
    }
    worksheet["!autofilter"] = { ref: XLSX.utils.encode_range(range) };
    worksheet["!freeze"] = { xSplit: 0, ySplit: 1 };
    worksheet["!cols"] = [{ wch: 20 }, { wch: 48 }, { wch: 22 }, { wch: 22 }, { wch: 24 }, { wch: 22 }, { wch: 16 }, { wch: 68 }, { wch: 100 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sin costo base");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="items_sin_costo_base_${new Date().toISOString().slice(0, 10)}.xlsx`,
      },
    });
  } catch (error) {
    return jsonError(error, "No se pudieron exportar los items sin costo base.");
  }
}
