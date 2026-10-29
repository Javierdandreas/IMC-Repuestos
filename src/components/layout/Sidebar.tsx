"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  HiOutlineCog,
  HiOutlineCube,
  HiOutlineLibrary,
  HiOutlineMenuAlt2,
  HiOutlineShoppingCart,
  HiOutlineUsers,
  HiX,
} from "react-icons/hi";
import { ThemeToggle } from "./ThemeToggle";
import LogoutButton from "../auth/LogoutButton";
import { useTheme } from "@/context/ThemeContext";
import { useUser } from "@/context/UserContext";
import { puedeAccederPermisos, type RequisitoPermiso } from "@/lib/permissions";

interface NavLink {
  href?: string;
  label: string;
  external?: boolean;
  disabled?: boolean;
  permisos?: RequisitoPermiso;
  soloAdmin?: boolean;
}

interface NavGroup {
  label: string;
  href: string;
  icon: React.ElementType;
  links: NavLink[];
}

interface UserProfile {
  nombre: string;
  rol: string;
  initials: string;
}

const navGroups: NavGroup[] = [
  {
    label: "Operaciones",
    href: "/operaciones?tipo=VENTA",
    icon: HiOutlineShoppingCart,
    links: [
      { href: "/operaciones?tipo=VENTA", label: "Ventas", permisos: ["ventas:leer"] },
      { href: "/operaciones?tipo=COMPRA", label: "Compras", permisos: ["compras:leer"] },
      { href: "/operaciones?tipo=AJUSTE", label: "Ajustes de stock", permisos: ["ajustes_stock:leer"] },
      { href: "/operaciones/mercadolibre", label: "Mercado Libre", permisos: ["ml_ventas:leer"] },
      { href: "/operaciones/mercadolibre/compatibilidades", label: "Compatibilidades", permisos: ["ml_compatibilidades:leer"] },
      { href: "https://imc-cerebro.vercel.app/", label: "Presupuestos", external: true },
    ],
  },
  {
    label: "Items",
    href: "/",
    icon: HiOutlineCube,
    links: [
      { href: "/", label: "Listado general", permisos: ["productos:leer"] },
      { href: "/piezas", label: "Items asociados", permisos: ["piezas:leer"] },
    ],
  },
  {
    label: "Contactos",
    href: "/proveedores",
    icon: HiOutlineUsers,
    links: [
      { href: "/proveedores", label: "Proveedores", permisos: ["proveedores:leer"] },
      { label: "Clientes", disabled: true },
    ],
  },
  {
    label: "Listados",
    href: "/listados/precios-modificados",
    icon: HiOutlineLibrary,
    links: [
      { href: "/listados/precios-modificados", label: "Costos modificados", permisos: ["costos_modificados:leer"] },
      { href: "/listados/movimientos-stock", label: "Movimientos de stock", permisos: ["movimientos_stock:leer"] },
      { href: "/ubicaciones/inventario", label: "Inventario por ubicacion", permisos: ["inventario_ubicacion:leer"] },
    ],
  },
  {
    label: "Configuracion",
    href: "/configuracion/datos",
    icon: HiOutlineCog,
    links: [
      { href: "/configuracion/datos", label: "Datos", permisos: ["marcas:leer", "categorias:leer", "ubicaciones:leer"] },
      { href: "/configuracion/base-de-datos", label: "Base de datos", permisos: ["marcas:leer", "categorias:leer", "ubicaciones:leer"] },
      { href: "/configuracion/precios", label: "Listas de precio", permisos: ["listas_precios:leer"] },
      { href: "/configuracion/multimoneda", label: "Multimoneda", permisos: ["multimoneda:leer"] },
      { href: "/configuracion/enriquecimiento", label: "Enriquecimiento", permisos: ["enriquecimiento:leer"] },
      { href: "/configuracion/usuarios", label: "Usuarios", soloAdmin: true },
      { href: "/importaciones", label: "Importaciones", permisos: ["importaciones:leer"] },
    ],
  },
];

export const Sidebar = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { theme } = useTheme();
  const { user } = useUser();
  const navRef = useRef<HTMLElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    nombre: "Cargando...",
    rol: "Admin",
    initials: "?",
  });

  const itemsHref = (() => {
    const returnTo = searchParams.get("returnTo");
    if (returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")) return returnTo;
    const params = searchParams.toString();
    return pathname === "/" && params ? `/?${params}` : "/";
  })();

  const navHref = (href: string) => href === "/" ? itemsHref : href;
  const puedeVerLink = (link: NavLink) => {
    if (link.soloAdmin) return user?.rol?.toLowerCase() === "admin";
    return !link.permisos || puedeAccederPermisos(user?.rol, user?.permisos, link.permisos);
  };
  const linksVisibles = (group: NavGroup) => group.links.filter(puedeVerLink);
  const gruposVisibles = navGroups.filter((group) => linksVisibles(group).length > 0);
  const hrefGrupo = (group: NavGroup) => {
    const principal = linksVisibles(group).find((link) => link.href && !link.external)?.href;
    return navHref(principal || group.href);
  };

  const isGroupActive = (group: NavGroup) => {
    if (group.label === "Items") return pathname === "/" || pathname.startsWith("/productos") || pathname.startsWith("/piezas") || pathname.startsWith("/kits");
    if (group.label === "Operaciones") return pathname.startsWith("/operaciones") || pathname === "/configuracion/mercadolibre";
    if (group.label === "Contactos") return pathname.startsWith("/proveedores") || pathname.startsWith("/clientes");
    if (group.label === "Configuracion") {
      return ["/configuracion", "/importaciones", "/marcas", "/categorias", "/ubicaciones"].some((route) => pathname.startsWith(route))
        && pathname !== "/configuracion/mercadolibre"
        && pathname !== "/ubicaciones/inventario";
    }
    if (group.label === "Listados") return pathname.startsWith("/listados") || pathname === "/ubicaciones/inventario";
    return false;
  };

  const activeGroup = gruposVisibles.find(isGroupActive) ?? null;

  const isLinkActive = (href?: string) => {
    if (!href || href.startsWith("http")) return false;
    const [linkPath, query = ""] = href.split("?");
    if (pathname !== linkPath) return false;
    if (!query) return true;
    return Array.from(new URLSearchParams(query).entries()).every(([key, value]) => searchParams.get(key) === value);
  };

  useEffect(() => {
    if (!user) return;

    const nombre = user.nombreUsuario || [user.nombre, user.apellido].filter(Boolean).join(" ") || user.email || "Usuario";
    const initials = nombre.split(" ").map((part) => part[0]).join("").toUpperCase().substring(0, 2);
    setUserProfile({ nombre, rol: user.rol || "Usuario", initials });
  }, [user]);

  useEffect(() => {
    const closeMenus = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", closeMenus);
    return () => document.removeEventListener("mousedown", closeMenus);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setUserMenuOpen(false);
  }, [pathname, searchParams]);

  return (
    <header ref={navRef} className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-black/95">
      <nav className="mx-auto flex h-16 max-w-[1600px] items-center gap-3 px-4 md:px-6" aria-label="Navegacion principal">
        <Link href={itemsHref} className="relative h-10 w-28 shrink-0" aria-label="Ir a items">
          <Image src={theme === "dark" ? "/imc-navbar-logo-negro.png" : "/imc-navbar-logo.png"} alt="IMC" fill className="object-contain object-left" priority />
        </Link>

        <div className="hidden h-full items-center gap-1 md:flex">
          {gruposVisibles.map((group) => {
            const Icon = group.icon;
            const active = isGroupActive(group);
            return (
              <Link key={group.label} href={hrefGrupo(group)} className={`flex h-full items-center gap-2 border-b-2 px-3 text-sm font-bold transition-colors ${active ? "border-blue-600 text-slate-950 dark:text-white" : "border-transparent text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white"}`}>
                <Icon className="h-5 w-5" />
                <span>{group.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          <ThemeToggle />
          <div className="relative">
            <button type="button" onClick={() => setUserMenuOpen((open) => !open)} className="flex items-center gap-2 border border-slate-200 px-2 py-1.5 text-left transition-colors hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-900" aria-expanded={userMenuOpen}>
              <span className="flex h-8 w-8 items-center justify-center bg-slate-950 text-xs font-black text-white dark:bg-white dark:text-slate-950">{userProfile.initials}</span>
              <span className="max-w-32 truncate text-xs font-bold text-slate-900 dark:text-white">{userProfile.nombre}</span>
            </button>
            {userMenuOpen && <div className="absolute right-0 top-full mt-2 w-56 border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-800 dark:bg-slate-950"><div className="border-b border-slate-100 px-3 py-2 dark:border-slate-800"><p className="truncate text-sm font-bold text-slate-950 dark:text-white">{userProfile.nombre}</p><p className="text-xs text-slate-500">{userProfile.rol}</p></div><LogoutButton className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" /></div>}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <button type="button" onClick={() => setMobileOpen((open) => !open)} className="flex h-10 w-10 items-center justify-center border border-slate-200 text-slate-700 dark:border-slate-800 dark:text-slate-200" aria-label="Abrir navegacion" aria-expanded={mobileOpen}>
            {mobileOpen ? <HiX className="h-6 w-6" /> : <HiOutlineMenuAlt2 className="h-6 w-6" />}
          </button>
        </div>
      </nav>

      {activeGroup && (
        <nav className="border-t border-slate-100 bg-slate-50 dark:border-slate-900 dark:bg-slate-950/80" aria-label={`Opciones de ${activeGroup.label}`}>
          <div className="mx-auto flex max-w-[1600px] items-center gap-1 overflow-x-auto px-4 py-2 md:px-6">
            {linksVisibles(activeGroup).map((link) => {
              const className = `whitespace-nowrap rounded-md px-3 py-2 text-xs font-bold transition-colors ${isLinkActive(link.href) ? "bg-white text-blue-600 shadow-sm dark:bg-slate-900 dark:text-blue-300" : "text-slate-500 hover:bg-white hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white"}`;
              if (link.disabled) return <span key={link.label} className="whitespace-nowrap px-3 py-2 text-xs font-bold text-slate-400 dark:text-slate-600" title="Proximamente">{link.label}</span>;
              if (link.external && link.href) return <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" className={className}>{link.label}</a>;
              return <Link key={link.label} href={navHref(link.href || "/")} className={className}>{link.label}</Link>;
            })}
          </div>
        </nav>
      )}

      {mobileOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-black md:hidden">
          <div className="grid grid-cols-2 gap-2">
            {gruposVisibles.map((group) => {
              const Icon = group.icon;
              return <Link key={group.label} href={hrefGrupo(group)} className={`flex items-center gap-2 border px-3 py-3 text-sm font-bold ${isGroupActive(group) ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300" : "border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-300"}`}><Icon className="h-5 w-5" />{group.label}</Link>;
            })}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 px-2 pt-3 dark:border-slate-900"><div><p className="text-sm font-bold text-slate-950 dark:text-white">{userProfile.nombre}</p><p className="text-xs text-slate-500">{userProfile.rol}</p></div><LogoutButton className="w-auto text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" /></div>
        </div>
      )}
    </header>
  );
};
