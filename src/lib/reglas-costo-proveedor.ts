export const ALCANCES_REGLA_COSTO = ["GENERAL", "MARCA"] as const;
export const TIPOS_AJUSTE_COSTO = [
  "COEFICIENTE",
  "QUITAR_IVA",
  "DESCUENTO_PORCENTUAL",
  "RECARGO_PORCENTUAL",
  "DESCUENTO_FIJO",
  "RECARGO_FIJO",
] as const;
export const TIPOS_CONDICION_COSTO = ["SIEMPRE", "STOCK_TEXTO"] as const;
export const OPERADORES_CONDICION_COSTO = ["CONTIENE"] as const;

export type AlcanceReglaCosto = typeof ALCANCES_REGLA_COSTO[number];
export type TipoAjusteCosto = typeof TIPOS_AJUSTE_COSTO[number];
export type TipoCondicionCosto = typeof TIPOS_CONDICION_COSTO[number];
export type OperadorCondicionCosto = typeof OPERADORES_CONDICION_COSTO[number];

export type ReglaCostoProveedor = {
  id?: number;
  id_proveedor?: number;
  nombre: string;
  alcance: AlcanceReglaCosto;
  id_marca: number | null;
  id_marcas?: number[];
  marca_descripcion?: string | null;
  tipo_ajuste: TipoAjusteCosto;
  valor: number;
  orden: number;
  activo: boolean;
  condicion_tipo?: TipoCondicionCosto;
  condicion_operador?: OperadorCondicionCosto;
  condicion_valor?: string | null;
};

function normalizarTexto(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

export function reglaCostoAplica(
  regla: ReglaCostoProveedor,
  idMarca?: number | null,
  stockTexto?: string | null,
) {
  const idMarcaRegla = regla.id_marca ?? regla.id_marcas?.[0] ?? null;
  const marcaAplica = regla.alcance === "GENERAL" || Number(idMarcaRegla) === Number(idMarca);
  if (!marcaAplica) return false;

  if (!regla.condicion_tipo || regla.condicion_tipo === "SIEMPRE") return true;
  const texto = normalizarTexto(stockTexto);
  const condicion = normalizarTexto(regla.condicion_valor);
  if (!texto || !condicion) return false;
  return texto.includes(condicion);
}

export function calcularCostoConReglasProveedor(
  precioLista: number | null | undefined,
  reglas: ReglaCostoProveedor[],
  idMarca?: number | null,
  stockTexto?: string | null,
): number | null {
  let costo = Number(precioLista);
  if (!Number.isFinite(costo) || costo < 0) return null;

  const reglasAplicables = reglas
    .filter((regla) => regla.activo && reglaCostoAplica(regla, idMarca, stockTexto))
    .sort((a, b) => a.orden - b.orden || (a.id ?? 0) - (b.id ?? 0));

  for (const regla of reglasAplicables) {
    const valor = Number(regla.valor);
    if (!Number.isFinite(valor) || valor < 0) continue;

    switch (regla.tipo_ajuste) {
      case "COEFICIENTE":
        if (valor > 0) costo *= valor;
        break;
      case "QUITAR_IVA":
        if (valor > 0) costo /= 1 + valor / 100;
        break;
      case "DESCUENTO_PORCENTUAL":
        costo *= 1 - valor / 100;
        break;
      case "RECARGO_PORCENTUAL":
        costo *= 1 + valor / 100;
        break;
      case "DESCUENTO_FIJO":
        costo -= valor;
        break;
      case "RECARGO_FIJO":
        costo += valor;
        break;
    }
  }

  return Math.round(Math.max(0, costo) * 100) / 100;
}

export function validarReglaCostoProveedor(regla: ReglaCostoProveedor) {
  const nombre = String(regla.nombre ?? "").trim();
  const alcance = regla.alcance;
  const tipo = regla.tipo_ajuste;
  const valor = Number(regla.valor);
  const idMarca = regla.id_marca === null || regla.id_marca === undefined ? null : Number(regla.id_marca);
  const idMarcas = [...new Set(
    (regla.id_marcas?.length ? regla.id_marcas : idMarca ? [idMarca] : []).map(Number),
  )];
  const condicionTipo = regla.condicion_tipo ?? "SIEMPRE";
  const condicionOperador = regla.condicion_operador ?? "CONTIENE";
  const condicionValor = String(regla.condicion_valor ?? "").trim();

  if (!nombre || nombre.length > 80) return "Cada capa debe tener un nombre de hasta 80 caracteres";
  if (!ALCANCES_REGLA_COSTO.includes(alcance)) return "El alcance de una capa no es valido";
  if (!TIPOS_AJUSTE_COSTO.includes(tipo)) return "El tipo de ajuste no es valido";
  if (alcance === "MARCA" && (idMarcas.length !== 1 || idMarcas.some((id) => !Number.isInteger(id) || id <= 0))) return "Selecciona una sola marca para cada capa por marca";
  if (alcance === "GENERAL" && idMarca !== null) return "Una capa general no puede tener una marca asignada";
  if (!Number.isFinite(valor) || valor < 0 || valor > 100000000) return "El valor de una capa no es valido";
  if (["COEFICIENTE", "QUITAR_IVA"].includes(tipo) && valor <= 0) return "El coeficiente y el IVA deben ser mayores a cero";
  if (["DESCUENTO_PORCENTUAL", "RECARGO_PORCENTUAL"].includes(tipo) && valor > 100) return "Los ajustes porcentuales no pueden superar 100%";
  if (!TIPOS_CONDICION_COSTO.includes(condicionTipo)) return "La condicion de una capa no es valida";
  if (!OPERADORES_CONDICION_COSTO.includes(condicionOperador)) return "El operador de condicion no es valido";
  if (condicionTipo === "STOCK_TEXTO" && !condicionValor) return "Indica el texto de stock que debe activar la capa";

  return null;
}
