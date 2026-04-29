import {
  Briefcase,
  CircleCheckBig,
  Clock,
  FileText,
  Globe,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  Settings,
  ShieldCheck,
  Table2,
  TrendingUp,
  UserRound,
  Zap,
} from "lucide-react";
import type { ReadonlyURLSearchParams } from "next/navigation";

export type SidebarItemColor =
  | "blue"
  | "amber"
  | "emerald"
  | "slate"
  | "indigo"
  | "red";

export type SidebarMenuItem = {
  label: string;
  href: string;
  icon?: any;
  badge?: string;
  color?: SidebarItemColor;
  external?: boolean;
};

export type MenuSection = {
  id: string;
  title: string;
  groups: {
    label?: string;
    items: SidebarMenuItem[];
  }[];
};

export type RailItem = {
  id: string;
  icon: any;
  label: string;
  href?: string;
};

export const navigationData: Record<string, MenuSection> = {
  dashboard: {
    id: "dashboard",
    title: "Inicio",
    groups: [
      {
        items: [
          {
            label: "Estadísticas Generales",
            href: "/presupuestos/estadisticas",
            icon: TrendingUp,
            color: "slate",
          },
          {
            label: "Panel de Control",
            href: "/presupuestos/general",
            icon: LayoutDashboard,
            color: "blue",
          }
        ],
      },
    ],
  },
  operaciones: {
    id: "operaciones",
    title: "Operaciones",
    groups: [
      {
        label: "Ventas y Presupuestos",
        items: [
          {
            label: "Nuevo Presupuesto",
            href: "/presupuestos/nuevo",
            icon: Zap,
            badge: "Nuevo",
            color: "blue",
          },
          {
            label: "Listado General",
            href: "/presupuestos/general",
            icon: FileText,
            color: "slate",
          },
          {
            label: "Presupuestos Pendientes",
            href: "/presupuestos/pendientes",
            icon: Clock,
            color: "amber",
          },
          {
            label: "Presupuestos Confirmados",
            href: "/presupuestos/confirmados",
            icon: CircleCheckBig,
            color: "emerald",
          },
          {
            label: "Estadísticas de Venta",
            href: "/presupuestos/estadisticas",
            icon: TrendingUp,
            color: "blue",
          },
        ],
      },
      {
        label: "Inventario y Stock",
        items: [
          {
            label: "Compras",
            href: "/operaciones?tipo=COMPRA",
            icon: Layers,
            color: "indigo",
          },
          {
            label: "Ajustes de Stock",
            href: "/operaciones?tipo=AJUSTE",
            icon: Settings,
            color: "slate",
          },
        ],
      },
    ],
  },
  catalogo: {
    id: "catalogo",
    title: "Inventario",
    groups: [
      {
        label: "Productos",
        items: [
          { label: "Items", href: "/productos", icon: Layers, color: "blue" },
          { label: "Piezas", href: "/piezas", icon: FileText, color: "slate" },
          { label: "Kits", href: "/kits", icon: Zap, color: "amber" },
        ],
      },
      {
        label: "Gestión de Datos",
        items: [
          { label: "Marcas", href: "/marcas", icon: Settings },
          { label: "Categorías", href: "/categorias", icon: Layers },
          { label: "Ubicaciones", href: "/ubicaciones", icon: Globe },
        ],
      },
    ],
  },
  maestros: {
    id: "maestros",
    title: "Entidades",
    groups: [
      {
        items: [
          {
            label: "Proveedores",
            href: "/proveedores",
            icon: UserRound,
            color: "slate",
          },
          {
            // No existe página dedicada de clientes todavía; el flujo activo vive en Presupuestos.
            label: "Clientes",
            href: "/presupuestos/nuevo",
            icon: UserRound,
            color: "slate",
          },
          {
            label: "Importaciones",
            href: "/importaciones",
            icon: Globe,
            color: "blue",
          },
        ],
      },
    ],
  },
  config: {
    id: "config",
    title: "Sistema",
    groups: [
      {
        label: "Administración",
        items: [
          {
            // TODO: reemplazar por la pantalla de usuarios cuando exista UI administrativa.
            label: "Gestión de Personal",
            href: "/configuracion/usuarios",
            icon: UserRound,
            color: "slate",
          },
          {
            // TODO: reemplazar por la pantalla de permisos canónicos cuando exista UI dedicada.
            label: "Roles y Permisos",
            href: "/login",
            icon: ShieldCheck,
            color: "slate",
          },
        ],
      },
    ],
  },
};

export const railItems: RailItem[] = [
  { id: "dashboard", icon: LayoutGrid, label: "Inicio", href: "/presupuestos/general" },
  { id: "operaciones", icon: Briefcase, label: "Operaciones", href: "/presupuestos/nuevo" },
  { id: "catalogo", icon: Layers, label: "Inventario", href: "/" },
  { id: "maestros", icon: Table2, label: "Entidades", href: "/proveedores" },
  { id: "config", icon: Settings, label: "Sistema", href: "/login" },
];

export function getSidebarSectionForPath(pathname: string): string | null {
  if (
    pathname.startsWith("/presupuestos/nuevo") ||
    pathname.startsWith("/presupuestos/pendientes") ||
    pathname.startsWith("/presupuestos/confirmados") ||
    pathname.startsWith("/operaciones")
  ) {
    return "operaciones";
  }

  if (
    pathname.startsWith("/presupuestos/general") ||
    pathname.startsWith("/presupuestos/estadisticas")
  ) {
    return "dashboard";
  }

  if (
    pathname === "/" ||
    pathname.startsWith("/piezas") ||
    pathname.startsWith("/kits") ||
    pathname.startsWith("/marcas") ||
    pathname.startsWith("/categorias") ||
    pathname.startsWith("/subcategorias") ||
    pathname.startsWith("/ubicaciones")
  ) {
    return "catalogo";
  }

  if (
    pathname.startsWith("/proveedores") ||
    pathname.startsWith("/importaciones")
  ) {
    return "maestros";
  }

  if (pathname.startsWith("/configuracion") || pathname.startsWith("/login")) {
    return "config";
  }

  return null;
}

export function isSidebarHrefActive(
  pathname: string,
  searchParams: URLSearchParams | ReadonlyURLSearchParams,
  href: string
) {
  if (href.startsWith("http://") || href.startsWith("https://")) {
    return false;
  }

  const [targetPath, queryString] = href.split("?");
  const pathMatches =
    targetPath === "/"
      ? pathname === "/"
      : pathname === targetPath || pathname.startsWith(`${targetPath}/`);

  if (!pathMatches) {
    return false;
  }

  if (!queryString) {
    return true;
  }

  const targetParams = new URLSearchParams(queryString);
  return Array.from(targetParams.entries()).every(
    ([key, value]) => searchParams.get(key) === value
  );
}
