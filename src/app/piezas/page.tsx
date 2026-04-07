import { PiezaList } from "@/components/piezas/PiezaList";
import { getCategoriasOptions, getSubcategoriasConCategoria } from "@/lib/repos/catalogos";
import { getPiezasListado, getNextCodigoPieza } from "@/lib/repos/piezas";

export default async function PiezasPage() {
  const [piezas, categorias, subcategorias, nextCode] = await Promise.all([
    getPiezasListado(),
    getCategoriasOptions(),
    getSubcategoriasConCategoria(),
    getNextCodigoPieza(),
  ]);

  return (
    <PiezaList
      piezas={piezas}
      categorias={categorias}
      subcategorias={subcategorias}
      nextCode={nextCode}
    />
  );
}
