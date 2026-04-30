import { PiezaList } from "@/components/piezas/PiezaList";
import { getCategoriasOptions, getSubcategoriasConCategoria } from "@/lib/repos/catalogos";
import { getPiezasListado, getNextCodigoPieza } from "@/modules/piezas/repos/piezas";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function PiezasPage({ searchParams }: Props) {
  const resolvedParams = await searchParams;
  const page = Number(resolvedParams?.page) || 1;

  const [{ data: piezas, totalPages }, categorias, subcategorias, nextCode] = await Promise.all([
    getPiezasListado(page, 50),
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
      totalPages={totalPages}
    />
  );
}
