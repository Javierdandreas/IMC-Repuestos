import { PiezaList } from "@/components/piezas/PiezaList";
import { getCategoriasOptions, getSubcategoriasConCategoria } from "@/lib/repos/catalogos";
import { getPiezasListado, getNextCodigoPieza } from "@/lib/repos/piezas";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function PiezasPage({ searchParams }: Props) {
  const resolvedParams = await searchParams;
  const page = Number(resolvedParams?.page) || 1;
  const readParam = (key: string) => {
    const value = resolvedParams?.[key];
    return typeof value === "string" ? value.slice(0, 100) : "";
  };
  const idParam = (key: string) => {
    const value = Number(readParam(key));
    return Number.isInteger(value) && value > 0 ? value : null;
  };
  const filters = {
    busquedaGeneral: readParam("q"),
    codigoExacto: readParam("codigo"),
    idCategoria: idParam("categoria"),
    idSubcategoria: idParam("subcategoria"),
  };

  const [{ data: piezas, totalPages, totalCount }, categorias, subcategorias, nextCode] = await Promise.all([
    getPiezasListado(page, 50, filters),
    getCategoriasOptions(),
    getSubcategoriasConCategoria(),
    getNextCodigoPieza(),
  ]);

  return (
    <div className="bg-white min-h-screen dark:bg-slate-950">
      <PiezaList
        piezas={piezas}
        categorias={categorias}
        subcategorias={subcategorias}
        nextCode={nextCode}
        totalPages={totalPages}
        totalCount={totalCount}
        initialFilters={{
          busquedaGeneral: filters.busquedaGeneral,
          codigoExacto: filters.codigoExacto,
          idCategoria: filters.idCategoria ? String(filters.idCategoria) : "",
          idSubcategoria: filters.idSubcategoria ? String(filters.idSubcategoria) : "",
        }}
      />
    </div>
  );
}
