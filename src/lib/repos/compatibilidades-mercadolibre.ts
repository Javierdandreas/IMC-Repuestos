import { AppError } from "@/lib/api-errors";
import { query, withTransaction } from "@/lib/db-utils";
import { sanitizeNullableString } from "@/utils/sanitization";

export type EstadoCompatibilidad = "PENDIENTE" | "CONFIRMADA" | "DESCARTADA";

export type CompatibilidadCandidata = {
  id: number;
  preguntaId: number;
  itemId: string | null;
  idProducto: number | null;
  idKit: number | null;
  idPieza: number | null;
  codigoPieza: number | null;
  tituloPublicacion: string | null;
  pregunta: string;
  respuestaHistorica: string | null;
  chasisDetectado: string | null;
  chasisConfirmado: string | null;
  vehiculo: string | null;
  motor: string | null;
  notas: string | null;
  estado: EstadoCompatibilidad;
  analizadoAt: string;
  revisadoAt: string | null;
};

type Row = {
  id: number;
  id_pregunta: number;
  item_id: string | null;
  id_producto: number | null;
  id_kit: number | null;
  id_pieza: number | null;
  codigo_pieza: number | null;
  titulo_publicacion: string | null;
  pregunta: string;
  respuesta_historica: string | null;
  chasis_detectado: string | null;
  chasis_confirmado: string | null;
  vehiculo: string | null;
  motor: string | null;
  notas: string | null;
  estado: EstadoCompatibilidad;
  analizado_at: string;
  revisado_at: string | null;
};

function optionalText(value: unknown, maxLength: number) {
  const text = sanitizeNullableString(value);
  return text ? text.slice(0, maxLength) : null;
}

function mapRow(row: Row): CompatibilidadCandidata {
  return {
    id: Number(row.id), preguntaId: Number(row.id_pregunta), itemId: row.item_id,
    idProducto: row.id_producto === null ? null : Number(row.id_producto), idKit: row.id_kit === null ? null : Number(row.id_kit),
    idPieza: row.id_pieza === null ? null : Number(row.id_pieza), codigoPieza: row.codigo_pieza === null ? null : Number(row.codigo_pieza),
    tituloPublicacion: row.titulo_publicacion, pregunta: row.pregunta, respuestaHistorica: row.respuesta_historica,
    chasisDetectado: row.chasis_detectado, chasisConfirmado: row.chasis_confirmado, vehiculo: row.vehiculo,
    motor: row.motor, notas: row.notas, estado: row.estado,
    analizadoAt: new Date(row.analizado_at).toISOString(), revisadoAt: row.revisado_at ? new Date(row.revisado_at).toISOString() : null,
  };
}

export async function analizarPreguntasParaCompatibilidades(idCuenta: number) {
  const result = await query<{ created: boolean }>(`
    WITH fuentes AS (
      SELECT
        question.id AS id_pregunta,
        question.id_cuenta,
        question.item_id,
        publication.id_producto,
        publication.id_kit,
        product.id_pieza,
        COALESCE(publication.titulo, question.titulo) AS titulo_publicacion,
        question.texto AS pregunta,
        question.respuesta AS respuesta_historica,
        (regexp_match(
          UPPER(question.texto),
          '([A-HJ-NPR-Z0-9]{17})'
        ))[1] AS chasis_detectado
      FROM public.mercadolibre_pregunta question
      LEFT JOIN public.mercadolibre_publicacion publication
        ON publication.id_cuenta = question.id_cuenta AND publication.item_id = question.item_id
      LEFT JOIN public.productos product ON product.id = publication.id_producto
      WHERE question.id_cuenta = $1
        AND question.texto ~* '(\\mchasis\\M|\\mvin\\M|\\mdominio\\M|\\mpatente\\M|\\mmotor\\M|\\mmodelo\\M|\\mcompatib[a-z]*\\M|\\maplica\\M)'
    )
    INSERT INTO public.mercadolibre_compatibilidad_candidata (
      id_cuenta, id_pregunta, item_id, id_producto, id_kit, id_pieza, titulo_publicacion,
      pregunta, respuesta_historica, chasis_detectado, analizado_at, updated_at
    )
    SELECT
      id_cuenta, id_pregunta, item_id, id_producto, id_kit, id_pieza, titulo_publicacion,
      pregunta, respuesta_historica, chasis_detectado, NOW(), NOW()
    FROM fuentes
    ON CONFLICT (id_cuenta, id_pregunta) DO UPDATE SET
      item_id = EXCLUDED.item_id,
      id_producto = EXCLUDED.id_producto,
      id_kit = EXCLUDED.id_kit,
      id_pieza = EXCLUDED.id_pieza,
      titulo_publicacion = EXCLUDED.titulo_publicacion,
      pregunta = EXCLUDED.pregunta,
      respuesta_historica = EXCLUDED.respuesta_historica,
      chasis_detectado = CASE
        WHEN mercadolibre_compatibilidad_candidata.estado = 'PENDIENTE' THEN EXCLUDED.chasis_detectado
        ELSE mercadolibre_compatibilidad_candidata.chasis_detectado
      END,
      analizado_at = NOW(),
      updated_at = NOW()
    RETURNING (xmax = 0) AS created
  `, [idCuenta]);

  return {
    analizadas: result.rowCount,
    nuevas: result.rows.filter((row) => row.created).length,
    actualizadas: result.rows.filter((row) => !row.created).length,
  };
}

export async function getCompatibilidadesCandidatas(input: {
  idCuenta: number;
  estado?: EstadoCompatibilidad | "TODAS";
  search?: string;
  page?: number;
  limit?: number;
}) {
  const params: unknown[] = [input.idCuenta];
  const where = ["candidate.id_cuenta = $1"];
  if (input.estado && input.estado !== "TODAS") {
    params.push(input.estado);
    where.push(`candidate.estado = $${params.length}`);
  }
  if (input.search?.trim()) {
    params.push(`%${input.search.trim()}%`);
    where.push(`(
      candidate.titulo_publicacion ILIKE $${params.length}
      OR candidate.pregunta ILIKE $${params.length}
      OR candidate.respuesta_historica ILIKE $${params.length}
      OR candidate.chasis_detectado ILIKE $${params.length}
      OR candidate.chasis_confirmado ILIKE $${params.length}
      OR candidate.vehiculo ILIKE $${params.length}
    )`);
  }
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const limit = Math.min(100, Math.max(1, Math.floor(input.limit ?? 50)));
  const offset = (page - 1) * limit;
  const whereSql = where.join(" AND ");

  const [countResult, summaryResult, rowsResult] = await Promise.all([
    query<{ total: string }>(`SELECT COUNT(*)::text AS total FROM public.mercadolibre_compatibilidad_candidata candidate WHERE ${whereSql}`, params),
    query<{ pendientes: string; confirmadas: string; descartadas: string }>(`
      SELECT
        COUNT(*) FILTER (WHERE estado = 'PENDIENTE')::text AS pendientes,
        COUNT(*) FILTER (WHERE estado = 'CONFIRMADA')::text AS confirmadas,
        COUNT(*) FILTER (WHERE estado = 'DESCARTADA')::text AS descartadas
      FROM public.mercadolibre_compatibilidad_candidata
      WHERE id_cuenta = $1
    `, [input.idCuenta]),
    query<Row>(`
      SELECT candidate.*, piece.codigo_pieza
      FROM public.mercadolibre_compatibilidad_candidata candidate
      LEFT JOIN public.pieza piece ON piece.id = candidate.id_pieza
      WHERE ${whereSql}
      ORDER BY
        CASE candidate.estado WHEN 'PENDIENTE' THEN 0 WHEN 'CONFIRMADA' THEN 1 ELSE 2 END,
        candidate.updated_at DESC,
        candidate.id DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, offset]),
  ]);
  const totalCount = Number(countResult.rows[0]?.total ?? 0);
  const summary = summaryResult.rows[0] || { pendientes: "0", confirmadas: "0", descartadas: "0" };
  return {
    data: rowsResult.rows.map(mapRow), totalCount, totalPages: Math.ceil(totalCount / limit), page,
    resumen: { pendientes: Number(summary.pendientes), confirmadas: Number(summary.confirmadas), descartadas: Number(summary.descartadas) },
  };
}

export async function actualizarCompatibilidadCandidata(idCuenta: number, id: number, input: Record<string, unknown>) {
  const estado = input.estado === "CONFIRMADA" || input.estado === "DESCARTADA" || input.estado === "PENDIENTE" ? input.estado : null;
  if (!estado) throw new AppError("El estado de compatibilidad no es valido.", 400);
  const chasisConfirmado = optionalText(input.chasisConfirmado, 40);
  const vehiculo = optionalText(input.vehiculo, 180);
  const motor = optionalText(input.motor, 120);
  const notas = optionalText(input.notas, 1_000);
  if (estado === "CONFIRMADA" && !chasisConfirmado && !vehiculo) {
    throw new AppError("Para confirmar, completa al menos el chasis o el vehiculo compatible.", 400);
  }

  return withTransaction(async (client) => {
    const result = await client.query<Row>(`
      UPDATE public.mercadolibre_compatibilidad_candidata candidate
      SET chasis_confirmado = $3, vehiculo = $4, motor = $5, notas = $6, estado = $7,
          revisado_at = CASE WHEN $7 = 'PENDIENTE' THEN NULL ELSE NOW() END,
          updated_at = NOW()
      WHERE candidate.id = $1 AND candidate.id_cuenta = $2
      RETURNING candidate.*, (SELECT codigo_pieza FROM public.pieza WHERE id = candidate.id_pieza) AS codigo_pieza
    `, [id, idCuenta, chasisConfirmado, vehiculo, motor, notas, estado]);
    if (!result.rows[0]) throw new AppError("No se encontro la compatibilidad indicada.", 404);
    return mapRow(result.rows[0]);
  });
}
