import Link from "next/link";
import { Download, FolderTree, MapPin, Tags, Upload } from "lucide-react";

type Catalogo = {
  tipo: "marcas" | "categorias" | "ubicaciones";
  href: string;
  titulo: string;
  descripcion: string;
  icono: typeof Tags;
};

const catalogos: Catalogo[] = [
  { tipo: "marcas", href: "/marcas", titulo: "Marcas", descripcion: "Marcas que clasifican items y piezas.", icono: Tags },
  { tipo: "categorias", href: "/categorias", titulo: "Categorias y subcategorias", descripcion: "Rubros y subrubros del catalogo de items.", icono: FolderTree },
  { tipo: "ubicaciones", href: "/ubicaciones", titulo: "Ubicaciones", descripcion: "Depositos, estantes y posiciones de stock.", icono: MapPin },
];

type AccionesCatalogo = Record<Catalogo["tipo"], { leer: boolean; importar: boolean; exportar: boolean }>;

export function BaseDeDatosPage({ acciones }: { acciones: AccionesCatalogo }) {
  return <main className="min-h-[calc(100dvh-4rem)] bg-slate-50 p-4 dark:bg-slate-950 md:p-6">
    <div className="mx-auto w-full max-w-[1500px]">
      <header className="border-b border-slate-200 pb-5 dark:border-slate-800">
        <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Listados</p>
        <h1 className="mt-2 text-2xl font-black text-slate-900 dark:text-white">Base de datos</h1>
        <p className="mt-1 text-sm font-medium text-slate-500">Consulta y transferencia de los catalogos maestros de IMC.</p>
      </header>

      <section className="mt-6 grid gap-4 lg:grid-cols-3" aria-label="Catalogos maestros">
        {catalogos.filter(({ tipo }) => acciones[tipo].leer).map(({ tipo, href, titulo, descripcion, icono: Icono }) => <article key={tipo} className="border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start gap-3"><span className="inline-flex h-10 w-10 shrink-0 items-center justify-center bg-blue-500/10 text-blue-600 dark:text-blue-300"><Icono className="h-5 w-5" /></span><div><h2 className="text-sm font-black text-slate-900 dark:text-white">{titulo}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{descripcion}</p></div></div>
          <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <Link href={href} className="inline-flex h-9 items-center px-3 text-xs font-black text-blue-600 hover:bg-blue-500/10 dark:text-blue-300">Ver listado</Link>
            {acciones[tipo].exportar && <a href={`/api/listados/base-de-datos/export?tipo=${tipo}`} className="inline-flex h-9 items-center gap-2 border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><Download className="h-3.5 w-3.5" />Exportar</a>}
            {acciones[tipo].importar && <Link href={`/listados/base-de-datos/importar?tipo=${tipo}`} className="inline-flex h-9 items-center gap-2 border border-blue-500/40 px-3 text-xs font-bold text-blue-700 hover:bg-blue-500/10 dark:text-blue-300"><Upload className="h-3.5 w-3.5" />Importar</Link>}
          </div>
        </article>)}
      </section>
    </div>
  </main>;
}
