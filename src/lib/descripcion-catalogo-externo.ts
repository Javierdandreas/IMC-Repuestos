export function limitarDescripcionCatalogoExterno(descripcion: string): string {
  return Array.from(descripcion).slice(0, 150).join("");
}
