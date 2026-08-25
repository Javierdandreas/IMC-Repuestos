import { withTransaction } from "@/lib/db-utils";
import type { DbClient } from "@/lib/db-utils";
import type { EstadoSerie } from "@/interfaces/series";
import type { ImportSeriesMapping, ImportSeriesResult } from "@/interfaces/series-import";
import {
  getTipoMovimientoSeriePorEstado,
  SERIE_ESTADOS_CON_STOCK_FISICO,
  SERIE_ESTADOS_CON_STOCK_FISICO_SET,
  SERIE_ESTADOS_PERMITIDOS_SET,
} from "@/lib/serie-estados";

function normalize(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

function readMapped(item: any, mappings: ImportSeriesMapping, key: keyof ImportSeriesMapping) {
  const header = mappings[key]?.csvHeader;
  if (!header) return "";
  return String(item?.[header] ?? "").trim();
}

function parseEstado(value: string): EstadoSerie {
  const normalized = normalize(value || "DISPONIBLE")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (!normalized) return "DISPONIBLE";
  if (normalized === "VENDER POR MOSTRADOR" || normalized === "VENTA MOSTRADOR") return "MOSTRADOR";
  if (normalized === "DEVOLUCION") return "DEVUELTO";
  if (normalized === "REPARACION") return "REPARACION";

  if (SERIE_ESTADOS_PERMITIDOS_SET.has(normalized as EstadoSerie)) {
    return normalized as EstadoSerie;
  }

  throw new Error(`Estado invalido: ${value}`);
}

async function getSinUbicacionId(client: DbClient) {
  const { rows } = await client.query(
    `
      INSERT INTO ubicaciones (descripcion)
      VALUES ('SIN UBICACION')
      ON CONFLICT (descripcion) DO UPDATE SET descripcion = EXCLUDED.descripcion
      RETURNING id
    `
  );
  return Number(rows[0].id);
}

export async function importSeriesUbicaciones(
  items: any[],
  mappings: ImportSeriesMapping,
  usuarioId: number
): Promise<ImportSeriesResult> {
  const startTime = Date.now();

  return await withTransaction(async (client) => {
    const result: ImportSeriesResult = {
      created: 0,
      updated: 0,
      ignored: 0,
      errors: [],
      durationMs: 0,
    };

    if (!mappings.codigo_producto?.csvHeader || !mappings.serie?.csvHeader) {
      throw new Error("Mapea como minimo las columnas Codigo item y Serie");
    }

    const [productosRes, ubicacionesRes] = await Promise.all([
      client.query("SELECT id, cod_unico, stock, usa_numero_serie FROM productos"),
      client.query("SELECT id, descripcion FROM ubicaciones"),
    ]);

    const productos = new Map<string, { id: number; stock: number; usa_numero_serie: boolean }>();
    productosRes.rows.forEach((row) => {
      productos.set(normalize(row.cod_unico), {
        id: Number(row.id),
        stock: Number(row.stock ?? 0),
        usa_numero_serie: Boolean(row.usa_numero_serie),
      });
    });

    const ubicaciones = new Map<string, number>();
    ubicacionesRes.rows.forEach((row) => {
      ubicaciones.set(normalize(row.descripcion), Number(row.id));
    });

    const sinUbicacionId = ubicaciones.get("SIN UBICACION") ?? (await getSinUbicacionId(client));

    const activeCountCache = new Map<number, number>();
    const getActiveCount = async (idProducto: number) => {
      if (activeCountCache.has(idProducto)) return activeCountCache.get(idProducto)!;
      const { rows } = await client.query(
        "SELECT COUNT(*)::int AS total FROM producto_serie WHERE id_producto = $1 AND estado = ANY($2::text[])",
        [idProducto, SERIE_ESTADOS_CON_STOCK_FISICO]
      );
      const total = Number(rows[0]?.total ?? 0);
      activeCountCache.set(idProducto, total);
      return total;
    };

    const setActiveCount = (idProducto: number, value: number) => {
      activeCountCache.set(idProducto, value);
    };

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const rowNumber = i + 2;
      const codigoProducto = readMapped(item, mappings, "codigo_producto");
      const serie = normalize(readMapped(item, mappings, "serie"));

      if (!codigoProducto && !serie) {
        result.ignored++;
        continue;
      }

      try {
        if (!codigoProducto) throw new Error("Falta codigo de item");
        if (!serie) throw new Error("Falta numero de serie");

        const producto = productos.get(normalize(codigoProducto));
        if (!producto) throw new Error("Item no encontrado");
        if (!producto.usa_numero_serie) throw new Error("El item no tiene trazabilidad activada");

        const ubicacionText = readMapped(item, mappings, "ubicacion");
        const idUbicacion = ubicacionText
          ? ubicaciones.get(normalize(ubicacionText))
          : sinUbicacionId;

        if (!idUbicacion) {
          throw new Error(`La ubicacion '${ubicacionText}' no existe`);
        }

        const estado = parseEstado(readMapped(item, mappings, "estado"));

        const existing = await client.query(
          `
            SELECT id, id_producto, id_ubicacion, estado
            FROM producto_serie
            WHERE numero_serie = $1
            FOR UPDATE
          `,
          [serie]
        );

        if (existing.rows.length > 0) {
          const current = existing.rows[0];
          const currentProductId = Number(current.id_producto);
          if (currentProductId !== producto.id) {
            throw new Error("La serie ya existe en otro item");
          }

          const oldEstado = current.estado as EstadoSerie;
          const oldUbicacion = current.id_ubicacion === null ? null : Number(current.id_ubicacion);
          const becomesActive = !SERIE_ESTADOS_CON_STOCK_FISICO_SET.has(oldEstado) && SERIE_ESTADOS_CON_STOCK_FISICO_SET.has(estado);
          if (becomesActive) {
            const activeCount = await getActiveCount(producto.id);
            if (activeCount + 1 > producto.stock) {
              throw new Error(`No hay stock disponible para activar esta serie. Stock declarado: ${producto.stock}`);
            }
            setActiveCount(producto.id, activeCount + 1);
          }

          const becomesInactive = SERIE_ESTADOS_CON_STOCK_FISICO_SET.has(oldEstado) && !SERIE_ESTADOS_CON_STOCK_FISICO_SET.has(estado);
          if (becomesInactive) {
            const activeCount = await getActiveCount(producto.id);
            setActiveCount(producto.id, Math.max(0, activeCount - 1));
          }

          const changesLocation = oldUbicacion !== idUbicacion;
          const changesState = oldEstado !== estado;
          if (!changesLocation && !changesState) {
            result.ignored++;
            continue;
          }

          await client.query(
            `
              UPDATE producto_serie
              SET id_ubicacion = $1,
                  estado = $2,
                  updated_at = now()
              WHERE id = $3
            `,
            [idUbicacion, estado, current.id]
          );

          if (changesLocation || changesState) {
            await client.query(
              `
                INSERT INTO producto_serie_movimiento (
                  id_producto_serie,
                  tipo,
                  id_ubicacion_origen,
                  id_ubicacion_destino,
                  observacion,
                  usuario_id
                )
                VALUES ($1, $2, $3, $4, $5, $6)
              `,
              [
                current.id,
                changesLocation ? "TRANSFERENCIA" : getTipoMovimientoSeriePorEstado(estado),
                oldUbicacion,
                idUbicacion,
                "Importacion de series por ubicacion",
                usuarioId,
              ]
            );
          }

          result.updated++;
          continue;
        }

        if (SERIE_ESTADOS_CON_STOCK_FISICO_SET.has(estado)) {
          const activeCount = await getActiveCount(producto.id);
          if (activeCount + 1 > producto.stock) {
            throw new Error(`No hay stock disponible para crear esta serie. Stock declarado: ${producto.stock}`);
          }
          setActiveCount(producto.id, activeCount + 1);
        }

        const inserted = await client.query(
          `
            INSERT INTO producto_serie (id_producto, numero_serie, estado, id_ubicacion, fecha_ingreso)
            VALUES ($1, $2, $3, $4, now())
            RETURNING id
          `,
          [producto.id, serie, estado, idUbicacion]
        );

        await client.query(
          `
            INSERT INTO producto_serie_movimiento (
              id_producto_serie,
              tipo,
              id_ubicacion_destino,
              observacion,
              usuario_id
            )
            VALUES ($1, 'INGRESO', $2, $3, $4)
          `,
          [inserted.rows[0].id, idUbicacion, "Importacion de series por ubicacion", usuarioId]
        );

        result.created++;
      } catch (error: any) {
        result.errors.push({
          row: rowNumber,
          codigo_producto: codigoProducto,
          serie,
          error: error.message || "Error importando la fila",
        });
      }
    }

    result.durationMs = Date.now() - startTime;
    return result;
  });
}
