import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { query } from "@/lib/db-utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_RESULTADOS = 100;

const documentSchema = z.string().trim().min(1).max(32).transform((value) => value.replace(/\D/g, ""));

const searchSchema = z.object({
  q: z.string().trim().min(2, "La busqueda debe tener al menos 2 caracteres.").max(120).optional(),
  tipoDocumento: z.enum(["DNI", "CUIT"]).optional(),
  numeroDocumento: documentSchema.optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_RESULTADOS, "El limite maximo es 100.").optional(),
}).superRefine((value, context) => {
  if (Boolean(value.tipoDocumento) !== Boolean(value.numeroDocumento)) {
    context.addIssue({ code: "custom", message: "tipoDocumento y numeroDocumento deben enviarse juntos." });
  }
  if (value.q && value.numeroDocumento) {
    context.addIssue({ code: "custom", message: "Usa q para una busqueda o tipoDocumento junto con numeroDocumento, no ambos." });
  }
  if (!value.q && !value.numeroDocumento) {
    context.addIssue({ code: "custom", message: "Indica q o tipoDocumento junto con numeroDocumento para consultar clientes." });
  }
  if (value.numeroDocumento && !/^\d{6,11}$/.test(value.numeroDocumento)) {
    context.addIssue({ code: "custom", message: "El numero de documento debe contener entre 6 y 11 digitos." });
  }
});

type PartnerClientRow = {
  id: number;
  razon_social: string;
  tipo_persona: "FISICA" | "JURIDICA";
  tipo_documento: string | null;
  documento: string | null;
  domicilio: string | null;
  localidad: string | null;
  provincia: string | null;
  codigo_postal: string | null;
  telefono: string | null;
  celular: string | null;
  email: string | null;
  contacto_nombre: string | null;
  contacto_telefono: string | null;
  contacto_celular: string | null;
  contacto_email: string | null;
  activo: boolean;
};

function keyIsValid(received: string | null) {
  const configured = process.env.PARTNER_CATALOG_API_KEY?.trim();
  if (!configured || !received) return false;

  const encoder = new TextEncoder();
  const expectedBytes = encoder.encode(configured);
  const receivedBytes = encoder.encode(received.trim());
  return expectedBytes.length === receivedBytes.length
    && timingSafeEqual(expectedBytes, receivedBytes);
}

function clean(value: string | null) {
  const text = value?.trim();
  return text || null;
}

function tipoDocumento(value: string | null) {
  const normalized = clean(value)?.toLocaleUpperCase("es-AR") ?? null;
  return normalized === "DNI" || normalized === "CUIT" ? normalized : null;
}

function numeroDocumento(value: string | null) {
  const normalized = clean(value)?.replace(/\D/g, "") ?? "";
  return /^\d{6,11}$/.test(normalized) ? normalized : null;
}

function serializeClient(row: PartnerClientRow) {
  const normalizedTipoDocumento = tipoDocumento(row.tipo_documento);
  const normalizedNumeroDocumento = numeroDocumento(row.documento);
  return {
    id: row.id,
    razonSocial: row.razon_social,
    tipoPersona: row.tipo_persona,
    tipoDocumento: normalizedTipoDocumento,
    numeroDocumento: normalizedNumeroDocumento,
    validoParaOrdenGesu: Boolean(normalizedTipoDocumento && normalizedNumeroDocumento),
    domicilio: clean(row.domicilio),
    localidad: clean(row.localidad),
    provincia: clean(row.provincia),
    codigoPostal: clean(row.codigo_postal),
    telefono: clean(row.telefono),
    celular: clean(row.celular),
    email: clean(row.email),
    contactoNombre: clean(row.contacto_nombre),
    contactoTelefono: clean(row.contacto_telefono),
    contactoCelular: clean(row.contacto_celular),
    contactoEmail: clean(row.contacto_email),
    activo: row.activo,
  };
}

async function findClients(input: z.infer<typeof searchSchema>) {
  const page = input.page ?? 1;
  const limit = input.limit ?? 25;
  const params: Array<string | number> = [];
  const where = ["cliente.activo = TRUE"];

  if (input.numeroDocumento && input.tipoDocumento) {
    params.push(input.tipoDocumento, input.numeroDocumento);
    where.push(`UPPER(TRIM(COALESCE(cliente.tipo_documento, ''))) = $${params.length - 1}`);
    where.push(`REGEXP_REPLACE(COALESCE(cliente.documento, ''), '[^0-9]', '', 'g') = $${params.length}`);
  } else if (input.q) {
    params.push(`%${input.q}%`);
    const parameter = params.length;
    where.push(`(
      cliente.razon_social ILIKE $${parameter}
      OR cliente.documento ILIKE $${parameter}
      OR cliente.telefono ILIKE $${parameter}
      OR cliente.celular ILIKE $${parameter}
      OR cliente.email ILIKE $${parameter}
      OR cliente.contacto_nombre ILIKE $${parameter}
      OR cliente.contacto_email ILIKE $${parameter}
    )`);
  }

  const condition = where.join(" AND ");
  const count = await query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM public.clientes cliente WHERE ${condition}`,
    params,
  );
  const total = Number(count.rows[0]?.total ?? 0);
  params.push(limit, (page - 1) * limit);
  const clients = await query<PartnerClientRow>(`
    SELECT
      cliente.id, cliente.razon_social, cliente.tipo_persona, cliente.tipo_documento, cliente.documento,
      cliente.domicilio, cliente.localidad, cliente.provincia, cliente.codigo_postal,
      cliente.telefono, cliente.celular, cliente.email,
      cliente.contacto_nombre, cliente.contacto_telefono, cliente.contacto_celular, cliente.contacto_email,
      cliente.activo
    FROM public.clientes cliente
    WHERE ${condition}
    ORDER BY cliente.razon_social ASC, cliente.id ASC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `, params);

  return {
    modo: input.numeroDocumento ? "DOCUMENTO" : "BUSQUEDA",
    consulta: input.numeroDocumento ? null : input.q ?? null,
    page,
    limit,
    total,
    clientes: clients.rows.map(serializeClient),
  };
}

async function handleClientsRequest(request: NextRequest, payload: unknown) {
  if (!process.env.PARTNER_CATALOG_API_KEY?.trim()) {
    console.error("[PARTNER CLIENTS] Falta configurar PARTNER_CATALOG_API_KEY.");
    return NextResponse.json({ message: "API de clientes no configurada." }, { status: 503 });
  }
  if (!keyIsValid(request.headers.get("x-api-key"))) {
    return NextResponse.json({ message: "No autorizado." }, { status: 401 });
  }

  const parsed = searchSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Parametros invalidos." }, { status: 400 });
  }

  try {
    return NextResponse.json(await findClients(parsed.data), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("[PARTNER CLIENTS] Error al consultar clientes:", error);
    return NextResponse.json({ message: "No se pudieron consultar los clientes." }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handleClientsRequest(request, {
    q: request.nextUrl.searchParams.get("q")?.trim() || undefined,
    tipoDocumento: request.nextUrl.searchParams.get("tipoDocumento")?.trim().toLocaleUpperCase("es-AR") || undefined,
    numeroDocumento: request.nextUrl.searchParams.get("numeroDocumento")?.trim() || undefined,
    page: request.nextUrl.searchParams.get("page") ?? undefined,
    limit: request.nextUrl.searchParams.get("limit") ?? undefined,
  });
}

export async function POST(request: NextRequest) {
  try {
    return handleClientsRequest(request, await request.json());
  } catch {
    return NextResponse.json({ message: "El cuerpo debe ser JSON valido." }, { status: 400 });
  }
}
