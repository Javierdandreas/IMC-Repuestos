export type GesuClientesPersona = Record<string, unknown>;
export type GesuClientesHeader = { data_tot: number; data_pag: number; data_ini?: unknown; data_fin?: unknown };

export class GesuClientesRespuestaError extends Error {
  codigo: "PAGINA_FUERA_RANGO" | "LIMITE_CONSULTAS" | "FORMATO_INVALIDO";
  constructor(codigo: "PAGINA_FUERA_RANGO" | "LIMITE_CONSULTAS" | "FORMATO_INVALIDO", message: string) {
    super(message);
    this.codigo=codigo;
    this.name = "GesuClientesRespuestaError";
  }
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function integer(value: unknown, minimum: number) {
  if (typeof value !== "number" && (typeof value !== "string" || !/^\d+$/.test(value.trim()))) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= minimum ? parsed : null;
}

export function analizarRespuestaClientesGesu(payload: unknown): { header: GesuClientesHeader; records: GesuClientesPersona[] } {
  const invalid = () => new GesuClientesRespuestaError("FORMATO_INVALIDO", "GESU devolvio una respuesta de clientes invalida: faltan encabezados o datos validos.");
  if (!object(payload)) throw invalid();
  if (typeof payload.error === "string" && payload.error.trim()) {
    const message = payload.error.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (/parametro\s+pag\s+con\s+valor\s+invalido/.test(message)) {
      throw new GesuClientesRespuestaError("PAGINA_FUERA_RANGO", "GESU rechazo la pagina de clientes: el numero de pagina ya no es valido.");
    }
    if (/limite|demasiadas|consultas por hora|rate limit/.test(message)) {
      throw new GesuClientesRespuestaError("LIMITE_CONSULTAS", "GESU alcanzo el limite de consultas de clientes. Se reintentara en la proxima ejecucion.");
    }
    // No devolver texto arbitrario del proveedor, que podria contener credenciales.
    throw new GesuClientesRespuestaError("FORMATO_INVALIDO", "GESU informo un error al consultar clientes; no devolvio una pagina de datos.");
  }
  if (!object(payload.header) || (!object(payload.data) && !Array.isArray(payload.data))) throw invalid();
  const total = integer(payload.header.data_tot, 0);
  const perPage = integer(payload.header.data_pag, 1);
  const records = Object.values(payload.data);
  if (total === null || perPage === null || !records.every(object)) throw invalid();
  return { header: { ...payload.header, data_tot: total, data_pag: perPage }, records };
}
