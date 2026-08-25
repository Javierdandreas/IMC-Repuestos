import { PiezaForm } from "@/components/piezas/PiezaForm";
import { getCategoriasOptions, getSubcategoriasConCategoria } from "@/lib/repos/catalogos";
import { getNextCodigoPieza } from "@/lib/repos/piezas";

export const dynamic = "force-dynamic";

export default async function NuevaPiezaPage() {
  const [categorias, subcategorias, nextCode] = await Promise.all([
    getCategoriasOptions(),
    getSubcategoriasConCategoria(),
    getNextCodigoPieza(),
  ]);

  return (
    <div className="min-h-screen bg-white p-4 dark:bg-slate-950 md:p-6">
      <div className="mx-auto w-full max-w-[1500px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <PiezaForm
          categorias={categorias}
          subcategorias={subcategorias}
          nextCode={nextCode}
        />
      </div>
    </div>
  );
}
