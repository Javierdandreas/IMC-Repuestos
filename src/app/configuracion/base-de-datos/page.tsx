import Link from "next/link";
import { FolderTree, MapPin, Tags } from "lucide-react";

const sections = [
  {
    href: "/marcas",
    title: "Marcas",
    description: "Marcas utilizadas para clasificar items y piezas.",
    icon: Tags,
  },
  {
    href: "/categorias",
    title: "Categorias y subcategorias",
    description: "Arbol de rubros y subrubros para ordenar el catalogo.",
    icon: FolderTree,
  },
  {
    href: "/ubicaciones",
    title: "Ubicaciones",
    description: "Depositos, estantes y posiciones de stock.",
    icon: MapPin,
  },
];

export default function ConfiguracionBaseDeDatosPage() {
  return <main className="min-h-[calc(100dvh-4rem)] bg-slate-50 p-4 dark:bg-slate-950 md:p-6">
    <div className="mx-auto w-full max-w-[1500px]">
      <header className="border-b border-slate-200 pb-5 dark:border-slate-800">
        <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Configuracion</p>
        <h1 className="mt-2 text-2xl font-black text-slate-900 dark:text-white">Base de datos</h1>
        <p className="mt-1 text-sm font-medium text-slate-500">Catalogos maestros utilizados para clasificar y ubicar los items.</p>
      </header>

      <section className="mt-6 grid gap-3 md:grid-cols-3" aria-label="Catalogos maestros">
        {sections.map(({ href, title, description, icon: Icon }) => <Link key={href} href={href} className="group flex min-h-32 items-center gap-4 border border-slate-200 bg-white p-5 transition hover:border-blue-500/50 hover:bg-blue-500/5 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500/50 dark:hover:bg-blue-500/10">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center bg-blue-500/10 text-blue-600 transition group-hover:bg-blue-600 group-hover:text-white dark:text-blue-300"><Icon className="h-5 w-5" /></span>
          <span className="min-w-0"><span className="block text-sm font-black text-slate-900 dark:text-white">{title}</span><span className="mt-1 block text-xs font-medium leading-5 text-slate-500">{description}</span></span>
        </Link>)}
      </section>
    </div>
  </main>;
}
