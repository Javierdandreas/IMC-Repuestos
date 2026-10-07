import { AppError } from "@/lib/api-errors";
import { query, withTransaction, type DbClient } from "@/lib/db-utils";

export type ConversionKit = { id: number; codigo: string; descripcion: string; motivos: string[] };
const normalize = (code: string) => code.trim().toUpperCase();
const ownedRelations = new Set(["producto_precio", "producto_proveedor", "producto_stock_ubicacion"]);
const preservedHistory = new Set(["producto_actividad", "proveedor_importacion_cambio_costo"]);
const relationLabels: Record<string, string> = {
  operacion_detalle: "Ventas o compras asociadas",
  producto_serie: "Series o historial de series",
  kit_detalle: "Usado como componente de un kit",
  catalogo_externo_item: "Vinculo con el catalogo externo",
  producto_origen_externo: "Vinculo de sincronizacion externa",
};

export async function revisarConversionesKit(db: DbClient, rawCodes: string[], lock = false): Promise<ConversionKit[]> {
  const codes = [...new Set(rawCodes.map(normalize).filter(Boolean))];
  if (!codes.length) return [];
  const products = await db.query<{ id: number; codigo: string; descripcion: string; stock: number }>(`
    SELECT id, cod_unico AS codigo, descripcion, stock FROM public.productos
    WHERE upper(trim(cod_unico)) = ANY($1::text[]) ORDER BY id ${lock ? "FOR UPDATE" : ""}
  `, [codes]);
  if (!products.rows.length) return [];
  const rows = products.rows.map((p) => ({ id: p.id, codigo: p.codigo, descripcion: p.descripcion,
    motivos: Number(p.stock) !== 0 ? ["Tiene stock propio; requiere conciliacion"] : [] }));
  const byId = new Map(rows.map((row) => [row.id, row]));
  const ids = rows.map((row) => row.id);
  const kits = await db.query<{ id: number; codigo_kit: string }>(`
    SELECT id, codigo_kit FROM public.kits WHERE upper(trim(codigo_kit)) = ANY($1::text[])
    ORDER BY id ${lock ? "FOR UPDATE" : ""}
  `, [codes]);
  const details = await db.query<{ id_kit: number; cantidad: number }>(`
    SELECT id_kit, cantidad FROM public.kit_detalle WHERE id_kit = ANY($1::int[])
    ${lock ? "FOR UPDATE" : ""}
  `, [kits.rows.map((kit) => kit.id)]);
  for (const row of rows) {
    const matching = kits.rows.filter((kit) => normalize(kit.codigo_kit) === normalize(row.codigo));
    const components = details.rows.filter((detail) => detail.id_kit === matching[0]?.id);
    if (matching.length !== 1 || !components.length || components.some((c) => !Number.isInteger(Number(c.cantidad)) || Number(c.cantidad) <= 0)) {
      row.motivos.push("No existe un unico kit completo y valido con ese codigo");
    }
    if (rows.filter((p) => normalize(p.codigo) === normalize(row.codigo)).length !== 1) {
      row.motivos.push("Codigo duplicado en items");
    }
  }
  const locations = await db.query<{ id_producto: number; cantidad: number }>(`
    SELECT id_producto, cantidad FROM public.producto_stock_ubicacion WHERE id_producto = ANY($1::int[])
    ${lock ? "FOR UPDATE" : ""}
  `, [ids]);
  for (const row of locations.rows) {
    if (Number(row.cantidad) !== 0) byId.get(row.id_producto)?.motivos.push("Tiene stock distribuido en ubicaciones");
  }

  // Inspect actual foreign keys as well as known relations. Unknown dependencies block deletion.
  const references = await db.query<{
    schema: string; name: string; relation: string; column_name: string; column_sql: string; deletion: string;
  }>(`
    SELECT ns.nspname AS schema, rel.relname AS name, format('%I.%I', ns.nspname, rel.relname) AS relation,
      att.attname AS column_name, format('%I', att.attname) AS column_sql, fk.confdeltype AS deletion
    FROM pg_constraint fk
    JOIN pg_class rel ON rel.oid = fk.conrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(fk.conkey)
    WHERE fk.contype = 'f' AND fk.confrelid = 'public.productos'::regclass
  `);
  for (const ref of references.rows) {
    if (ref.schema === "public" && ref.column_name === "id_producto" && (
      ownedRelations.has(ref.name) || (preservedHistory.has(ref.name) && ref.deletion === "n")
    )) continue;
    const linked = await db.query<{ id: number }>(`
      SELECT DISTINCT ${ref.column_sql} AS id FROM ${ref.relation} WHERE ${ref.column_sql} = ANY($1::int[])
    `, [ids]);
    for (const linkedRow of linked.rows) {
      byId.get(linkedRow.id)?.motivos.push(relationLabels[ref.name] || `Relacion pendiente: ${ref.schema}.${ref.name}`);
    }
  }
  return rows.map((row) => ({ ...row, motivos: [...new Set(row.motivos)] }));
}

export async function eliminarOriginalesConvertidos(
  db: DbClient,
  codes: string[],
  userId: number,
  activityTitle = "Original eliminado tras conversion a kit",
) {
  const review = await revisarConversionesKit(db, codes, true);
  const blocked = review.filter((row) => row.motivos.length);
  if (blocked.length) throw new AppError(`Conversion bloqueada. ${blocked.slice(0, 12).map((row) => `${row.codigo}: ${row.motivos.join(", ")}`).join(" | ")}`, 409);
  if (!review.length) return [];
  const ids = review.map((row) => row.id);
  await db.query(`
    INSERT INTO public.producto_actividad (id_producto, codigo_producto, tipo, titulo, datos, usuario_id)
    SELECT p.id, p.cod_unico, 'CONVERSION_KIT', $3,
      jsonb_build_object('producto', to_jsonb(p), 'proveedores',
        (SELECT COALESCE(jsonb_agg(to_jsonb(pp)), '[]'::jsonb) FROM public.producto_proveedor pp WHERE pp.id_producto = p.id),
        'precios', (SELECT COALESCE(jsonb_agg(to_jsonb(precio)), '[]'::jsonb) FROM public.producto_precio precio WHERE precio.id_producto = p.id)),
      $2::int
    FROM public.productos p WHERE p.id = ANY($1::int[])
  `, [ids, userId, activityTitle]);
  await db.query("DELETE FROM public.producto_precio WHERE id_producto = ANY($1::int[])", [ids]);
  await db.query("DELETE FROM public.producto_proveedor WHERE id_producto = ANY($1::int[])", [ids]);
  await db.query("DELETE FROM public.producto_stock_ubicacion WHERE id_producto = ANY($1::int[])", [ids]);
  await db.query("DELETE FROM public.productos WHERE id = ANY($1::int[])", [ids]);
  return review.map((row) => row.codigo);
}

export async function listarOriginalesOcultos() {
  return withTransaction(async (db) => {
    const result = await db.query<{ cod_unico: string }>(`
      SELECT cod_unico FROM public.productos WHERE oculto_por_kit = true ORDER BY id LIMIT 501
    `);
    return {
      rows: await revisarConversionesKit(db, result.rows.slice(0, 500).map((row) => row.cod_unico)),
      hasMore: result.rows.length > 500,
    };
  });
}

export async function limpiarOriginalesOcultos(ids: number[], userId: number) {
  return withTransaction(async (db) => {
    await db.query("SET LOCAL lock_timeout = '10s'");
    const selected = await db.query<{ cod_unico: string }>(`
      SELECT cod_unico FROM public.productos WHERE id = ANY($1::int[]) AND oculto_por_kit = true ORDER BY id FOR UPDATE
    `, [ids]);
    if (selected.rows.length !== new Set(ids).size) throw new AppError("La seleccion cambio. Actualiza la revision antes de eliminar.", 409);
    return eliminarOriginalesConvertidos(db, selected.rows.map((row) => row.cod_unico), userId);
  });
}

export async function listarItemsDuplicadosConKits() {
  return withTransaction(async (db) => {
    const candidates = await db.query<{ codigo: string }>(`
      SELECT DISTINCT p.cod_unico AS codigo
      FROM public.productos p
      INNER JOIN public.kits k
        ON upper(trim(k.codigo_kit)) = upper(trim(p.cod_unico))
      ORDER BY p.cod_unico
      LIMIT 501
    `);
    return {
      rows: await revisarConversionesKit(db, candidates.rows.slice(0, 500).map((row) => row.codigo)),
      hasMore: candidates.rows.length > 500,
    };
  });
}

export async function limpiarItemsDuplicadosConKits(ids: number[], userId: number) {
  return withTransaction(async (db) => {
    await db.query("SET LOCAL lock_timeout = '10s'");
    const selected = await db.query<{ codigo: string }>(`
      SELECT p.cod_unico AS codigo
      FROM public.productos p
      INNER JOIN public.kits k
        ON upper(trim(k.codigo_kit)) = upper(trim(p.cod_unico))
      WHERE p.id = ANY($1::int[])
      ORDER BY p.id
      FOR UPDATE
    `, [ids]);
    if (selected.rows.length !== new Set(ids).size) {
      throw new AppError("La seleccion cambio. Actualiza la revision antes de eliminar.", 409);
    }
    return eliminarOriginalesConvertidos(
      db,
      selected.rows.map((row) => row.codigo),
      userId,
      "Item duplicado eliminado por coincidir con el codigo de un kit",
    );
  });
}
