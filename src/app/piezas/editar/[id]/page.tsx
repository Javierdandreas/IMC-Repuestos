import { PiezaForm } from "@/components/piezas/PiezaForm";
import { getCategoriasOptions, getSubcategoriasConCategoria } from "@/lib/repos/catalogos";
import { getPiezaById } from "@/lib/repos/piezas";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export default async function EditarPiezaPage({ params }: Props) {
  const { id } = await params;
  const [pieza, categorias, subcategorias] = await Promise.all([
    getPiezaById(id),
    getCategoriasOptions(),
    getSubcategoriasConCategoria(),
  ]);

  if (!pieza) notFound();

  return (
    <div className="min-h-screen bg-white p-4 dark:bg-slate-950 md:p-6">
      <div className="mx-auto w-full max-w-[1500px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <PiezaForm
          piezaId={Number(id)}
          initialPieza={pieza}
          categorias={categorias}
          subcategorias={subcategorias}
        />
      </div>
    </div>
  );
}
