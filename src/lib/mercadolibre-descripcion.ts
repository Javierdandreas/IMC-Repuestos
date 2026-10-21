export function atributosParaDescripcion(attributes: unknown): { id: string; nombre: string; valor: string }[] {
  if (!Array.isArray(attributes)) return [];
  return attributes.flatMap((entry: unknown) => {
    if (!entry || typeof entry !== "object") return [];
    const attribute = entry as Record<string, unknown>;
    if (typeof attribute.id !== "string" || /SKU|GTIN|TAX|IMPORT_DUTY|PACKAGE|CATALOG_TITLE|HAS_COMPATIBILITIES/.test(attribute.id)) return [];
    const values = Array.isArray(attribute.values) ? attribute.values.flatMap((value: unknown) => {
      if (!value || typeof value !== "object") return [];
      const name = (value as Record<string, unknown>).name;
      return typeof name === "string" && name.trim() ? [name.trim()] : [];
    }) : [];
    const valor = typeof attribute.value_name === "string" && attribute.value_name.trim()
      ? attribute.value_name.trim() : values.join(", ");
    if (!valor) return [];
    return [{ id: attribute.id, nombre: typeof attribute.name === "string" ? attribute.name : attribute.id, valor }];
  });
}
