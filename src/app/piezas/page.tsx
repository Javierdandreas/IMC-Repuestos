import { PiezaList } from "@/components/piezas/PiezaList";
import { getCategoriasOptions, getSubcategoriasOptions } from "@/lib/repos/catalogos";
import { getPiezasListado } from "@/lib/repos/piezas";

export default async function PiezasPage() {
  const [piezas, categorias, subcategorias] = await Promise.all([
    getPiezasListado(),
    getCategoriasOptions(),
    getSubcategoriasOptions(),
  ]);

  return <PiezaList piezas={piezas} categorias={categorias} subcategorias={subcategorias} />;
}
