export function prepararValidacionPublicacion(item: Record<string, unknown>, nombre: string) {
  if (Array.isArray(item.variations) && item.variations.length) {
    throw new Error("La validacion de publicaciones con variaciones todavia no esta disponible.");
  }
  const payload: Record<string, unknown> = {};
  for (const key of ["category_id", "price", "currency_id", "available_quantity", "buying_mode", "listing_type_id", "condition", "catalog_product_id"]) {
    if (item[key] !== null && item[key] !== undefined) payload[key] = item[key];
  }
  payload[item.user_product_id ? "family_name" : "title"] = nombre;
  if (Array.isArray(item.pictures)) {
    payload.pictures = item.pictures.flatMap((picture: Record<string, unknown>) =>
      typeof picture?.id === "string" ? [{ id: picture.id }] : []);
  }
  if (Array.isArray(item.attributes)) {
    payload.attributes = item.attributes.flatMap((attribute: Record<string, unknown>) => {
      if (typeof attribute?.id !== "string") return [];
      const result: Record<string, unknown> = { id: attribute.id };
      if (attribute.value_id) result.value_id = attribute.value_id;
      else if (attribute.value_name) result.value_name = attribute.value_name;
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
