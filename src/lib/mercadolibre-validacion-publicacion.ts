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
