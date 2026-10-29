import Link from "next/link";
import { CarFront, CircleDollarSign, ExternalLink, MessageCircle, Settings2, ShoppingCart } from "lucide-react";

type Section = "VENTAS" | "PUBLICACIONES" | "COSTOS" | "PREGUNTAS" | "COMPATIBILIDADES" | "SINCRONIZACION";

const sections: Array<{ id: Section; label: string; icon: typeof ShoppingCart; href: string }> = [
  { id: "VENTAS", label: "Ventas", icon: ShoppingCart, href: "/operaciones/mercadolibre?tab=VENTAS" },
  { id: "PUBLICACIONES", label: "Publicaciones", icon: ExternalLink, href: "/operaciones/mercadolibre?tab=PUBLICACIONES" },
  { id: "COSTOS", label: "Costos ML", icon: CircleDollarSign, href: "/operaciones/mercadolibre?tab=COSTOS" },
  { id: "PREGUNTAS", label: "Preguntas", icon: MessageCircle, href: "/operaciones/mercadolibre?tab=PREGUNTAS" },
  { id: "COMPATIBILIDADES", label: "Compatibilidades", icon: CarFront, href: "/operaciones/mercadolibre/compatibilidades" },
  { id: "SINCRONIZACION", label: "Sincronizacion", icon: Settings2, href: "/operaciones/mercadolibre?tab=SINCRONIZACION" },
];

export function MercadoLibreNavigation({ active, canViewCompatibilidades }: { active: Section; canViewCompatibilidades: boolean }) {
  return <nav className="flex overflow-x-auto border-b border-slate-200 dark:border-slate-800" aria-label="Secciones de Mercado Libre">{sections.filter((section) => section.id !== "COMPATIBILIDADES" || canViewCompatibilidades).map((section) => {
    const Icon = section.icon;
    const selected = section.id === active;
    return <Link key={section.id} href={section.href} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-xs font-black uppercase tracking-wide transition ${selected ? "border-blue-600 text-blue-600 dark:text-blue-300" : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"}`}><Icon className="h-4 w-4" />{section.label}</Link>;
  })}</nav>;
}
