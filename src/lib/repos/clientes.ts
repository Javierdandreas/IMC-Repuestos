import { revalidatePath } from "next/cache";
import { query, withTransaction, type DbClient } from "@/lib/db-utils";
import { AppError } from "@/lib/api-errors";

export type ClienteDescuentoMarca = {
  id_marca: number;
  marca: string;
  descuento: number;
};

export type Cliente = {
  id: number;
  gesu_id: number | null;
  razon_social: string;
  tipo_persona: "FISICA" | "JURIDICA";
  tipo_documento: string | null;
  documento: string | null;
  condicion_iva: string | null;
  comprobante_default: string | null;
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
  id_tipo_precio: number | null;
  tipo_precio: string | null;
  bonificacion_general: number;
  activo: boolean;
  importado_desde_gesu: boolean;
  ultima_sincronizacion_gesu: string | null;
  descuentos_marca: ClienteDescuentoMarca[];
};

export type ClienteInput = {
  razon_social?: unknown;
  tipo_persona?: unknown;
  tipo_documento?: unknown;
  documento?: unknown;
  condicion_iva?: unknown;
  comprobante_default?: unknown;
  domicilio?: unknown;
  localidad?: unknown;
  provincia?: unknown;
  codigo_postal?: unknown;
  telefono?: unknown;
  celular?: unknown;
  email?: unknown;
  contacto_nombre?: unknown;
  contacto_telefono?: unknown;
  contacto_celular?: unknown;
  contacto_email?: unknown;
  id_tipo_precio?: unknown;
  bonificacion_general?: unknown;
  activo?: unknown;
  descuentos_marca?: unknown;
};

export type ClienteFilters = {
  page?: number;
  limit?: number;
  search?: string;
  tipoPersona?: string;
  condicionIva?: string;
  idTipoPrecio?: string;
  bonificacion?: string;
  descuentoMarca?: string;
  estado?: string;
};

const IVA_VALIDOS = new Set(["RESPONSABLE_INSCRIPTO", "MONOTRIBUTO", "EXENTO", "CONSUMIDOR_FINAL", "NO_RESPONSABLE"]);
const COMPROBANTES_VALIDOS = new Set(["FACTURA_A", "FACTURA_B"]);

function cleanText(value: unknown, uppercase = false) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  return uppercase ? text.toLocaleUpperCase("es-AR") : text;
}

function cleanEmail(value: unknown) {
  const email = cleanText(value)?.toLocaleLowerCase();
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError("El email no tiene un formato valido.", 400);
  return email;
}

function parseOptionalId(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new AppError("La lista de precios no es valida.", 400);
  return id;
}

function parsePercentage(value: unknown) {
  const percentage = Number(value ?? 0);
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
    throw new AppError("La bonificacion debe estar entre 0 y 100.", 400);
  }
  return percentage;
}

function parseDescuentosMarca(value: unknown): Array<{ id_marca: number; descuento: number }> {
  if (!Array.isArray(value)) return [];
  const seen = new Set<number>();
  return value.map((item) => {
    const row = item as { id_marca?: unknown; descuento?: unknown };
    const idMarca = Number(row.id_marca);
    const descuento = Number(row.descuento);
    if (!Number.isInteger(idMarca) || idMarca <= 0 || !Number.isFinite(descuento) || descuento < 0 || descuento > 100) {
      throw new AppError("Hay un descuento por marca invalido.", 400);
    }
    if (seen.has(idMarca)) throw new AppError("Una marca solo puede tener un descuento por cliente.", 400);
    seen.add(idMarca);
    return { id_marca: idMarca, descuento };
  });
}

function normalizeInput(input: ClienteInput) {
  const razonSocial = cleanText(input.razon_social);
  if (!razonSocial) throw new AppError("El nombre o razon social es obligatorio.", 400);

  const tipoPersona = cleanText(input.tipo_persona, true) || "FISICA";
  if (tipoPersona !== "FISICA" && tipoPersona !== "JURIDICA") throw new AppError("El tipo de persona no es valido.", 400);

  const condicionIva = cleanText(input.condicion_iva, true);
  if (condicionIva && !IVA_VALIDOS.has(condicionIva)) throw new AppError("La condicion de IVA no es valida.", 400);
  const comprobante = cleanText(input.comprobante_default, true);
  if (comprobante && !COMPROBANTES_VALIDOS.has(comprobante)) throw new AppError("El comprobante predeterminado no es valido.", 400);

  const activo = !(input.activo === false || input.activo === 0 || input.activo === "false" || input.activo === "0");
  return {
    razon_social: razonSocial,
    tipo_persona: tipoPersona,
    tipo_documento: cleanText(input.tipo_documento, true),
    documento: cleanText(input.documento),
    condicion_iva: condicionIva,
    comprobante_default: comprobante,
    domicilio: cleanText(input.domicilio),
    localidad: cleanText(input.localidad),
    provincia: cleanText(input.provincia),
    codigo_postal: cleanText(input.codigo_postal),
    telefono: cleanText(input.telefono),
    celular: cleanText(input.celular),
    email: cleanEmail(input.email),
    contacto_nombre: cleanText(input.contacto_nombre),
    contacto_telefono: cleanText(input.contacto_telefono),
    contacto_celular: cleanText(input.contacto_celular),
    contacto_email: cleanEmail(input.contacto_email),
    id_tipo_precio: parseOptionalId(input.id_tipo_precio),
    bonificacion_general: parsePercentage(input.bonificacion_general),
    activo,
    descuentos_marca: parseDescuentosMarca(input.descuentos_marca),
  };
}

async function assertTipoPrecio(client: DbClient, idTipoPrecio: number | null) {
  if (!idTipoPrecio) return;
  const result = await client.query("SELECT 1 FROM public.tipo_precio WHERE id = $1 LIMIT 1", [idTipoPrecio]);
  if (result.rows.length === 0) throw new AppError("La lista de precios seleccionada no existe.", 400);
}

async function replaceDescuentosMarca(client: DbClient, idCliente: number, descuentos: Array<{ id_marca: number; descuento: number }>) {
  if (descuentos.length > 0) {
    const ids = descuentos.map((item) => item.id_marca);
    const brands = await client.query<{ id: number }>("SELECT id FROM public.marcas WHERE id = ANY($1::int[])", [ids]);
    if (brands.rows.length !== ids.length) throw new AppError("Una de las marcas seleccionadas no existe.", 400);
  }
  await client.query("DELETE FROM public.cliente_descuento_marca WHERE id_cliente = $1", [idCliente]);
  for (const descuento of descuentos) {
    await client.query(
      "INSERT INTO public.cliente_descuento_marca (id_cliente, id_marca, descuento) VALUES ($1, $2, $3)",
      [idCliente, descuento.id_marca, descuento.descuento],
    );
  }
}

const CLIENTE_SELECT = `
  cliente.id, cliente.gesu_id, cliente.razon_social, cliente.tipo_persona,
  cliente.tipo_documento, cliente.documento, cliente.condicion_iva, cliente.comprobante_default,
  cliente.domicilio, cliente.localidad, cliente.provincia, cliente.codigo_postal,
  cliente.telefono, cliente.celular, cliente.email,
  cliente.contacto_nombre, cliente.contacto_telefono, cliente.contacto_celular, cliente.contacto_email,
  cliente.id_tipo_precio, tipo_precio.descripcion AS tipo_precio,
  cliente.bonificacion_general::float AS bonificacion_general, cliente.activo,
  cliente.importado_desde_gesu, cliente.ultima_sincronizacion_gesu,
  COALESCE(descuentos.items, '[]'::json) AS descuentos_marca
`;

function clientRow(row: Cliente): Cliente {
  return { ...row, descuentos_marca: Array.isArray(row.descuentos_marca) ? row.descuentos_marca : [] };
}

export async function getClientes(filters: ClienteFilters = {}) {
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(filters.limit) || 25));
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, value: unknown) => { params.push(value); where.push(sql.replace("?", `$${params.length}`)); };

  const search = filters.search?.trim();
  if (search) {
    params.push(`%${search}%`);
    const index = params.length;
    where.push(`(cliente.razon_social ILIKE $${index} OR cliente.documento ILIKE $${index} OR cliente.telefono ILIKE $${index} OR cliente.celular ILIKE $${index} OR cliente.email ILIKE $${index})`);
  }
  if (filters.tipoPersona === "FISICA" || filters.tipoPersona === "JURIDICA") add("cliente.tipo_persona = ?", filters.tipoPersona);
  if (filters.condicionIva) add("cliente.condicion_iva = ?", filters.condicionIva);
  if (filters.idTipoPrecio && /^\d+$/.test(filters.idTipoPrecio)) add("cliente.id_tipo_precio = ?", Number(filters.idTipoPrecio));
  if (filters.bonificacion === "CON") where.push("cliente.bonificacion_general > 0");
  if (filters.bonificacion === "SIN") where.push("cliente.bonificacion_general = 0");
  if (filters.descuentoMarca === "CON") where.push("EXISTS (SELECT 1 FROM public.cliente_descuento_marca descuento_filtro WHERE descuento_filtro.id_cliente = cliente.id)");
  if (filters.descuentoMarca === "SIN") where.push("NOT EXISTS (SELECT 1 FROM public.cliente_descuento_marca descuento_filtro WHERE descuento_filtro.id_cliente = cliente.id)");
  if (filters.estado === "ACTIVO") where.push("cliente.activo = true");
  if (filters.estado === "INACTIVO") where.push("cliente.activo = false");

  const condition = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const count = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM public.clientes cliente ${condition}`, params);
  const totalCount = Number(count.rows[0]?.count ?? 0);
  const offset = (page - 1) * limit;
  const listParams = [...params, limit, offset];
  const { rows } = await query<Cliente>(`
    SELECT ${CLIENTE_SELECT}
    FROM public.clientes cliente
    LEFT JOIN public.tipo_precio tipo_precio ON tipo_precio.id = cliente.id_tipo_precio
    LEFT JOIN LATERAL (
      SELECT json_agg(json_build_object('id_marca', descuento.id_marca, 'marca', marca.descripcion, 'descuento', descuento.descuento::float) ORDER BY marca.descripcion) AS items
      FROM public.cliente_descuento_marca descuento
      JOIN public.marcas marca ON marca.id = descuento.id_marca
      WHERE descuento.id_cliente = cliente.id
    ) descuentos ON true
    ${condition}
    ORDER BY cliente.razon_social ASC, cliente.id ASC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `, listParams);
  return { data: rows.map(clientRow), totalCount, totalPages: totalCount ? Math.ceil(totalCount / limit) : 0 };
}

export async function getClienteById(id: number) {
  const { rows } = await query<Cliente>(`
    SELECT ${CLIENTE_SELECT}
    FROM public.clientes cliente
    LEFT JOIN public.tipo_precio tipo_precio ON tipo_precio.id = cliente.id_tipo_precio
    LEFT JOIN LATERAL (
      SELECT json_agg(json_build_object('id_marca', descuento.id_marca, 'marca', marca.descripcion, 'descuento', descuento.descuento::float) ORDER BY marca.descripcion) AS items
      FROM public.cliente_descuento_marca descuento
      JOIN public.marcas marca ON marca.id = descuento.id_marca
      WHERE descuento.id_cliente = cliente.id
    ) descuentos ON true
    WHERE cliente.id = $1
  `, [id]);
  return rows[0] ? clientRow(rows[0]) : null;
}

export async function createCliente(input: ClienteInput) {
  const value = normalizeInput(input);
  const cliente = await withTransaction(async (client) => {
    await assertTipoPrecio(client, value.id_tipo_precio);
    const { rows } = await client.query<{ id: number }>(`
      INSERT INTO public.clientes (
        razon_social, tipo_persona, tipo_documento, documento, condicion_iva, comprobante_default,
        domicilio, localidad, provincia, codigo_postal, telefono, celular, email,
        contacto_nombre, contacto_telefono, contacto_celular, contacto_email,
        id_tipo_precio, bonificacion_general, activo
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
      ) RETURNING id
    `, [
      value.razon_social, value.tipo_persona, value.tipo_documento, value.documento, value.condicion_iva, value.comprobante_default,
      value.domicilio, value.localidad, value.provincia, value.codigo_postal, value.telefono, value.celular, value.email,
      value.contacto_nombre, value.contacto_telefono, value.contacto_celular, value.contacto_email,
      value.id_tipo_precio, value.bonificacion_general, value.activo,
    ]);
    const id = rows[0].id;
    await replaceDescuentosMarca(client, id, value.descuentos_marca);
    return id;
  });
  revalidatePath("/clientes");
  return getClienteById(cliente);
}

export async function updateCliente(id: number, input: ClienteInput) {
  const value = normalizeInput(input);
  await withTransaction(async (client) => {
    await assertTipoPrecio(client, value.id_tipo_precio);
    const updated = await client.query("UPDATE public.clientes SET razon_social = $1, tipo_persona = $2, tipo_documento = $3, documento = $4, condicion_iva = $5, comprobante_default = $6, domicilio = $7, localidad = $8, provincia = $9, codigo_postal = $10, telefono = $11, celular = $12, email = $13, contacto_nombre = $14, contacto_telefono = $15, contacto_celular = $16, contacto_email = $17, id_tipo_precio = $18, bonificacion_general = $19, activo = $20, updated_at = now() WHERE id = $21 RETURNING id", [
      value.razon_social, value.tipo_persona, value.tipo_documento, value.documento, value.condicion_iva, value.comprobante_default,
      value.domicilio, value.localidad, value.provincia, value.codigo_postal, value.telefono, value.celular, value.email,
      value.contacto_nombre, value.contacto_telefono, value.contacto_celular, value.contacto_email,
      value.id_tipo_precio, value.bonificacion_general, value.activo, id,
    ]);
    if (updated.rows.length === 0) throw new AppError("Cliente no encontrado.", 404);
    await replaceDescuentosMarca(client, id, value.descuentos_marca);
  });
  revalidatePath("/clientes");
  return getClienteById(id);
}
