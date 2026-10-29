import Link from "next/link";

export default function SinPermisosPage() {
  return <main className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-xl items-center p-6">
    <section className="w-full border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-bold uppercase text-amber-600">Acceso restringido</p>
      <h1 className="mt-2 text-xl font-bold text-slate-950 dark:text-white">No tenes permiso para abrir esta seccion.</h1>
      <p className="mt-2 text-sm text-slate-500">Un administrador debe asignarte el permiso correspondiente desde Usuarios.</p>
      <Link href="/" className="mt-5 inline-flex rounded bg-blue-600 px-3 py-2 text-xs font-bold text-white">Volver al inicio</Link>
    </section>
  </main>;
}
