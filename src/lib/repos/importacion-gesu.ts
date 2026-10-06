import { query, withTransaction, type DbClient } from "@/lib/db-utils";
import { AppError } from "@/lib/api-errors";
import { GESU_KIT_MAPPINGS, GESU_PRODUCT_MAPPINGS, type GesuImportResult } from "@/lib/gesu-importacion";
import { importProductosConCliente } from "@/lib/repos/productos";
import { importKitsConCliente } from "@/lib/repos/kits";
import { eliminarOriginalesConvertidos } from "@/lib/repos/conversion-kits";
import { cantidadComponenteKitValida } from "@/lib/kit-cantidades";

export type GesuCatalogType = "productos" | "kits";

const MAX_CODES_PER_REQUEST = 1000;

const normalizeCode = (value: unknown) => String(value ?? "").trim().toUpperCase();

/** Busca codigos existentes para clasificar altas y actualizaciones en una vista previa. */
export async function findExistingGesuCodes(type: GesuCatalogType, rawCodes: unknown[]) {
  const codes = Array.from(new Set(rawCodes.map(normalizeCode).filter(Boolean)));

  if (codes.length === 0) return [];
  if (codes.length > MAX_CODES_PER_REQUEST) {
    throw new AppError(`La consulta admite hasta ${MAX_CODES_PER_REQUEST} codigos por vez`, 400);
  }

  if (type === "productos") {
    const result = await query<{ code: string }>(
      `SELECT UPPER(cod_unico) AS code FROM public.productos WHERE UPPER(cod_unico) = ANY($1::text[])`,
      [codes]
    );
    return result.rows.map((row) => row.code);
  }

  const result = await query<{ code: string }>(
    `SELECT UPPER(codigo_kit) AS code FROM public.kits WHERE UPPER(codigo_kit) = ANY($1::text[])`,
    [codes]
  );
  return result.rows.map((row) => row.code);
}

type StagedSession = { usuario_id: number; archivo: string; total_lotes: number; resultado: GesuImportResult | null; expired: boolean };
type StagedRow = Record<string, string | number | null>;
type StagedBatch = { numero: number; tipo: GesuCatalogType; filas: StagedRow[] };

async function session(db: DbClient, id: string, userId: number, lock = false) {
  const result = await db.query<StagedSession>(`
    SELECT usuario_id, archivo, total_lotes, resultado, created_at < now() - interval '24 hours' AS expired
    FROM public.gesu_importacion WHERE id = $1 AND usuario_id = $2 ${lock ? "FOR UPDATE" : ""}
  `, [id, userId]);
  const current = result.rows[0];
  if (!current) throw new AppError("Importacion no encontrada.", 404);
  if (current.expired && !current.resultado) throw new AppError("La carga temporal vencio. Vuelve a preparar el archivo.", 410);
  return current;
}

export async function iniciarImportacionGesu(id: string, userId: number, fileName: string, batches: number) {
  return withTransaction(async (db) => {
    // Only discard this user's expired, unapplied staging data, never catalog data.
    await db.query("DELETE FROM public.gesu_importacion WHERE usuario_id = $1 AND resultado IS NULL AND created_at < now() - interval '24 hours'", [userId]);
    await db.query(`INSERT INTO public.gesu_importacion (id, usuario_id, archivo, total_lotes)
      VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`, [id, userId, fileName, batches]);
    const current = await session(db, id, userId, true);
    if (current.archivo !== fileName || current.total_lotes !== batches) throw new AppError("La importacion ya existe con otro contenido.", 409);
    return { id, result: current.resultado };
  });
}

export async function guardarLoteGesu(id: string, userId: number, batch: number, type: GesuCatalogType, rows: StagedRow[]) {
  if (Buffer.byteLength(JSON.stringify(rows)) > 2_000_000) throw new AppError("El lote supera el tamano permitido.", 413);
  return withTransaction(async (db) => {
    await db.query("SET LOCAL lock_timeout = '5s'");
    const current = await session(db, id, userId, true);
    if (current.resultado) return { saved: true, result: current.resultado };
    if (batch >= current.total_lotes) throw new AppError("Numero de lote invalido.");
    const result = await db.query(`INSERT INTO public.gesu_importacion_lote (id_importacion, numero, tipo, filas)
      VALUES ($1, $2, $3, $4::jsonb) ON CONFLICT (id_importacion, numero) DO UPDATE SET filas = gesu_importacion_lote.filas
      WHERE gesu_importacion_lote.tipo = EXCLUDED.tipo AND gesu_importacion_lote.filas = EXCLUDED.filas RETURNING numero`,
    [id, batch, type, JSON.stringify(rows)]);
    if (!result.rowCount) throw new AppError("El lote ya fue recibido con otro contenido.", 409);
    return { saved: true };
  });
}

export async function estadoImportacionGesu(id: string, userId: number) {
  return withTransaction(async (db) => {
    const current = await session(db, id, userId);
    return { id, result: current.resultado };
  });
}

export async function aplicarImportacionGesu(id: string, userId: number, userName: string) {
  return withTransaction(async (db) => {
    await db.query("SET LOCAL lock_timeout = '10s'");
    await db.query("SET LOCAL statement_timeout = '120s'");
    await db.query("SET LOCAL idle_in_transaction_session_timeout = '30s'");
    const current = await session(db, id, userId, true);
    if (current.resultado) return current.resultado;
    const mutex = await db.query<{ locked: boolean }>("SELECT pg_try_advisory_xact_lock(73124, 1) AS locked");
    if (!mutex.rows[0].locked) throw new AppError("Hay otra importacion GESU en curso. Vuelve a intentar.", 409);
    const batches = await db.query<StagedBatch>("SELECT numero, tipo, filas FROM public.gesu_importacion_lote WHERE id_importacion = $1 ORDER BY numero", [id]);
    if (batches.rows.length !== current.total_lotes || batches.rows.some((batch, i) => batch.numero !== i)) {
      throw new AppError("Faltan lotes. No se modifico el catalogo.", 409);
    }
    const products = batches.rows.filter((batch) => batch.tipo === "productos").flatMap((batch) => batch.filas);
    const kits = batches.rows.filter((batch) => batch.tipo === "kits").flatMap((batch) => batch.filas);
    const productCodes = new Set<string>();
    const kitCodes = new Set<string>();
    for (const product of products) {
      const code = normalizeCode(product["Codigo Unico"]);
      if (!code || code.length > 50 || productCodes.has(code)) throw new AppError(`Codigo de item vacio, repetido o demasiado largo: ${code}`);
      productCodes.add(code);
      const stock = product.Stock;
      if (stock !== null && stock !== undefined && String(stock).trim() !== "" && (!Number.isSafeInteger(Number(stock)) || Number(stock) < 0)) {
        throw new AppError(`Stock invalido para ${code}.`);
      }
    }
    for (const kit of kits) {
      const code = normalizeCode(kit["Codigo Kit"]);
      if (!code || code.length > 100 || productCodes.has(code)) throw new AppError(`Codigo de kit invalido o tambien declarado como producto: ${code}`);
      if (!normalizeCode(kit["Codigo Item"]) || !cantidadComponenteKitValida(kit.Cantidad)) throw new AppError(`Componente o cantidad invalida: ${code}`);
      kitCodes.add(code);
    }
    const result: GesuImportResult = { productsImported: 0, productsUpdated: 0, kitsImported: 0, kitsUpdated: 0, deletedProducts: 0, missingProviders: [], errors: [] };
    const started = Date.now();
    const checkDeadline = () => {
      if (Date.now() - started > 220_000) throw new AppError("La importacion excedio el tiempo disponible. No se guardaron cambios; divide el archivo en importaciones menores.", 408);
    };
    for (let offset = 0; offset < products.length; offset += 2500) {
      checkDeadline();
      const imported = await importProductosConCliente(db, products.slice(offset, offset + 2500), userName, current.archivo, GESU_PRODUCT_MAPPINGS);
      if (imported.errors.length || imported.ignored) throw new AppError(`No se guardaron cambios. ${imported.errors.slice(0, 15).map((e) => `${e.cod_unico}: ${e.error}`).join(" | ") || "Hay items invalidos."}`);
      result.productsImported += imported.imported;
      result.productsUpdated += imported.updated;
    }
    checkDeadline();
    if (kits.length) {
      const imported = await importKitsConCliente(db, kits, userName, current.archivo, GESU_KIT_MAPPINGS);
      if (imported.errors.length || imported.ignored) throw new AppError(`No se guardaron cambios. ${imported.errors.slice(0, 15).map((e) => `${e.cod_kit}: ${e.error}`).join(" | ")}`);
      result.kitsImported = imported.imported;
      result.kitsUpdated = imported.updated;
      checkDeadline();
      result.deletedProducts = (await eliminarOriginalesConvertidos(db, [...kitCodes], userId)).length;
    }
    await db.query(`INSERT INTO public.log_importaciones (usuario, archivo, items_importados, items_ignorados, cantidad_errores, detalles_errores, duracion_ms)
      VALUES ($1, $2, $3, 0, 0, $4, $5)`, [userName, current.archivo, result.productsImported + result.productsUpdated + result.kitsImported + result.kitsUpdated, JSON.stringify([]), Date.now() - started]);
    await db.query("UPDATE public.gesu_importacion SET resultado = $2::jsonb, aplicada_at = now() WHERE id = $1", [id, JSON.stringify(result)]);
    await db.query("DELETE FROM public.gesu_importacion_lote WHERE id_importacion = $1", [id]);
    return result;
  });
}
