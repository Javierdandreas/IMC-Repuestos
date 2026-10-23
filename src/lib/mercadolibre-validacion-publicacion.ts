export function prepararValidacionPublicacion(item: Record<string, unknown>, nombre: string) {
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
    payload.attributes = item.attributes.flatMap((attribute: Record<string, unknown>) => {
      if (typeof attribute?.id !== "string") return [];
      if ([
        "CATALOG_TITLE", "HAS_COMPATIBILITIES", "SELLER_PACKAGE_DATA_SOURCE", "SYI_PYMES_ID",
        "GTIN", "PACKAGE_HEIGHT", "PACKAGE_LENGTH", "PACKAGE_WEIGHT", "PACKAGE_WIDTH",
        "PRODUCT_FEATURES", "SHIPMENT_PACKING",
      ].includes(attribute.id)) return [];
      const valueName = typeof attribute.value_name === "string" ? attribute.value_name.trim() : "";
      // Mercado Libre rejects these attributes when the source only contains an obsolete value_id.
      // It is safer to omit them than to create a publication with invented product data.
      if (["MATERIAL", "CORE_MATERIAL", "ORIGIN"].includes(attribute.id) && !valueName) return [];
      const result: Record<string, unknown> = { id: attribute.id };
      if (["MATERIAL", "CORE_MATERIAL", "ORIGIN"].includes(attribute.id)) result.value_name = valueName;
      else if (attribute.value_id) result.value_id = attribute.value_id;
      else if (valueName) result.value_name = valueName;
      else return [];
      return [result];
    });
  }
  return payload;
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
