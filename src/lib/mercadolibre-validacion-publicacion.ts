export type AtributoCategoriaPublicacion = {
  id: string;
  nombre: string;
  requerido: boolean;
  soloLectura: boolean;
  inferido: boolean;
  tipoValor: string;
  longitudMaxima: number | null;
  valores: Array<{ id: string; nombre: string }>;
  unidadesPermitidas: string[];
};

const ATTRIBUTOS_OMITIDOS = new Set([
  "CATALOG_TITLE", "HAS_COMPATIBILITIES", "SELLER_PACKAGE_DATA_SOURCE", "SYI_PYMES_ID", "PACKAGE_DATA_SOURCE",
  "GTIN", "PACKAGE_HEIGHT", "PACKAGE_LENGTH", "PACKAGE_WEIGHT", "PACKAGE_WIDTH", "PRODUCT_FEATURES", "SHIPMENT_PACKING",
]);
const ATTRIBUTOS_SOLO_TEXTO = new Set([
  "MATERIAL", "CORE_MATERIAL", "ORIGIN", "CONFIGURATION", "GRADE_TYPE", "O_RING_MATERIAL",
  "CYLINDER_BORE_DIAMETER", "O_RING_OUTSIDE_DIAMETER", "O_RING_THICKNESS",
]);

function text(value: unknown, maxLength: number | null = null) {
  const result = typeof value === "string" ? value.trim() : "";
  return maxLength && maxLength > 0 ? result.slice(0, maxLength) : result;
}

function valueStruct(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const number = typeof source.number === "number" ? source.number : Number(source.number);
  if (!Number.isFinite(number)) return null;
  const unit = text(source.unit);
  return unit ? { number, unit } : { number };
}

function sameText(left: string, right: string) {
  return left.localeCompare(right, "es", { sensitivity: "accent" }) === 0;
}

export function prepararValidacionPublicacion(item: Record<string, unknown>, nombre: string, atributosCategoria: AtributoCategoriaPublicacion[] = []) {
  if (Array.isArray(item.variations) && item.variations.length) {
    throw new Error("La validacion de publicaciones con variaciones todavia no esta disponible.");
  }
  const payload: Record<string, unknown> = {};
  for (const key of ["category_id", "price", "currency_id", "available_quantity", "buying_mode", "listing_type_id", "condition", "catalog_product_id"]) {
    if (item[key] !== null && item[key] !== undefined) payload[key] = item[key];
  }
  payload[item.user_product_id ? "family_name" : "title"] = nombre;
  if (item.shipping && typeof item.shipping === "object") {
    const shipping = item.shipping as Record<string, unknown>;
    if (shipping.mode === "me2") {
      const proposedShipping: Record<string, unknown> = { mode: "me2" };
      if (typeof shipping.local_pick_up === "boolean") proposedShipping.local_pick_up = shipping.local_pick_up;
      if (typeof shipping.free_shipping === "boolean") proposedShipping.free_shipping = shipping.free_shipping;
      payload.shipping = proposedShipping;
    }
  }
  if (Array.isArray(item.pictures)) {
    payload.pictures = item.pictures.flatMap((picture: Record<string, unknown>) =>
      typeof picture?.id === "string" ? [{ id: picture.id }] : []);
  }
  if (Array.isArray(item.attributes)) {
    const definiciones = new Map(atributosCategoria.map((attribute) => [attribute.id, attribute]));
    payload.attributes = item.attributes.flatMap<Record<string, unknown>>((attribute: Record<string, unknown>) => {
      const id = text(attribute?.id);
      if (!id || ATTRIBUTOS_OMITIDOS.has(id)) return [];
      const definition = definiciones.get(id);
      // La ficha actual de la categoria decide que atributos siguen siendo aceptados por ML.
      if (definiciones.size && (!definition || definition.soloLectura || definition.inferido)) return [];

      const valueName = text(attribute.value_name, definition?.longitudMaxima ?? null);
      const valueId = text(attribute.value_id);
      const struct = valueStruct(attribute.value_struct);
      const matchingValue = definition?.valores.find((value) => value.id === valueId || (valueName && sameText(value.nombre, valueName)));

      if (ATTRIBUTOS_SOLO_TEXTO.has(id)) return valueName ? [{ id, value_name: valueName }] : [];
      if (definition?.tipoValor === "list" && definition.valores.length && !matchingValue) return [];
      if (definition?.tipoValor === "number_unit" && struct) {
        if (definition.unidadesPermitidas.length && struct.unit && !definition.unidadesPermitidas.includes(struct.unit)) return [];
        return [{ id, value_struct: struct }];
      }
      if (definition?.tipoValor === "number" && struct) return [{ id, value_struct: { number: struct.number } }];
      if (matchingValue) return [{ id, value_id: matchingValue.id }];
      if (valueName) return [{ id, value_name: valueName }];
      if (valueId && !/^(null|undefined)$/i.test(valueId)) return [{ id, value_id: valueId }];
      return [];
    });
  }
  return payload;
}

export function atributosObligatoriosFaltantes(atributosCategoria: AtributoCategoriaPublicacion[], payload: Record<string, unknown>) {
  const enviados = new Set(Array.isArray(payload.attributes)
    ? payload.attributes.flatMap((attribute) => attribute && typeof attribute === "object" && typeof (attribute as Record<string, unknown>).id === "string"
      ? [(attribute as Record<string, unknown>).id as string]
      : [])
    : []);
  return atributosCategoria
    .filter((attribute) => attribute.requerido && !attribute.soloLectura && !attribute.inferido && !enviados.has(attribute.id))
    .map((attribute) => ({ id: attribute.id, nombre: attribute.nombre }));
}

export function interpretarValidacionPublicacion(status: number, data: unknown) {
  const response = data && typeof data === "object" ? data as Record<string, unknown> : {};
  const causes = Array.isArray(response.cause) ? response.cause : [];
  return {
    validada: status === 204,
    status,
    mensaje: typeof response.message === "string" ? response.message : "",
    error: typeof response.error === "string" ? response.error : "",
    detalles: causes.flatMap((value: unknown) => {
      if (!value || typeof value !== "object") return [];
      const cause = value as Record<string, unknown>;
      return [{
        tipo: typeof cause.type === "string" ? cause.type : "",
        codigo: typeof cause.code === "string" ? cause.code : "",
        mensaje: typeof cause.message === "string" ? cause.message : "",
        referencias: Array.isArray(cause.references) ? cause.references.filter((reference): reference is string => typeof reference === "string") : [],
      }];
    }),
  };
}

export function protegerDiagnostico(value: unknown, tokens: string[]): unknown {
  if (typeof value === "string") {
    let result = value.replace(/\bBearer\s+\S+/gi, "Bearer [OCULTO]");
    for (const token of tokens) if (token) result = result.split(token).join("[OCULTO]");
    return result;
  }
  if (Array.isArray(value)) return value.map((entry) => protegerDiagnostico(entry, tokens));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key,
      /authorization|token|secret|password|cookie|api.?key/i.test(key) ? "[OCULTO]" : protegerDiagnostico(entry, tokens),
    ]));
  }
  return value;
}
