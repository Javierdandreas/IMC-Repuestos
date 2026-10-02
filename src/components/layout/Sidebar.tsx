"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  HiChevronDown,
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
import { createClient } from "@/utils/supabase/client";

interface NavLink {
  href?: string;
  label: string;
  external?: boolean;
  disabled?: boolean;
}

interface NavGroup {
  label: string;
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
    icon: HiOutlineShoppingCart,
    links: [
      { href: "/operaciones?tipo=COMPRA", label: "Compras" },
      { href: "/operaciones?tipo=VENTA", label: "Ventas" },
      { href: "/operaciones?tipo=AJUSTE", label: "Ajustes de stock" },
      { href: "https://imc-cerebro.vercel.app/", label: "Presupuestos", external: true },
    ],
  },
  {
    label: "Items",
    icon: HiOutlineCube,
    links: [
      { href: "/", label: "Items" },
      { href: "/piezas", label: "Items asociados" },
    ],
  },
  {
    label: "Contactos",
    icon: HiOutlineUsers,
    links: [
      { href: "/proveedores", label: "Proveedores" },
      { label: "Clientes", disabled: true },
    ],
  },
  {
    label: "Listados",
    icon: HiOutlineLibrary,
    links: [
      { href: "/listados/precios-modificados", label: "Costos modificados" },
      { href: "/ubicaciones/inventario", label: "Inventario por ubicacion" },
      { label: "Movimientos de stock", disabled: true },
    ],
  },
  {
    label: "Configuracion",
    icon: HiOutlineCog,
    links: [
      { href: "/configuracion/datos", label: "Datos" },
      { href: "/configuracion/precios", label: "Listas de precio" },
      { href: "/importaciones", label: "Importaciones" },
      { href: "/marcas", label: "Marcas" },
      { href: "/categorias", label: "Categorias" },
      { href: "/ubicaciones", label: "Ubicaciones" },
      { href: "/ubicaciones/inventario", label: "Inventario por ubicacion" },
    ],
  },
];

export const Sidebar = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { theme } = useTheme();
  const navRef = useRef<HTMLElement>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
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

  const isGroupActive = useCallback(
    (group: NavGroup) => {
      if (group.label === "Items") return pathname === "/" || pathname.startsWith("/productos") || pathname.startsWith("/piezas") || pathname.startsWith("/kits");
      if (group.label === "Operaciones") return pathname.startsWith("/operaciones");
      if (group.label === "Contactos") return pathname.startsWith("/proveedores") || pathname.startsWith("/clientes");
      if (group.label === "Configuracion") {
        return ["/configuracion", "/importaciones", "/marcas", "/categorias", "/ubicaciones"].some((route) => pathname.startsWith(route))
          && pathname !== "/ubicaciones/inventario";
      }
      if (group.label === "Listados") return pathname.startsWith("/listados") || pathname === "/ubicaciones/inventario";
      return false;
    },
    [pathname],
  );

  useEffect(() => {
    const fetchUserProfile = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: authData } = await supabase
        .from("usuario_auth")
        .select("rol, usuario:usuario_id(nombre_usuario)")
        .eq("auth_user_id", user.id)
        .single();
      if (!authData) return;

      const nombre = (authData.usuario as { nombre_usuario?: string } | null)?.nombre_usuario || "Usuario";
      const initials = nombre.split(" ").map((part) => part[0]).join("").toUpperCase().substring(0, 2);
      setUserProfile({ nombre, rol: authData.rol || "Administrador", initials });
    };

    fetchUserProfile();
  }, []);

  useEffect(() => {
    const closeMenus = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setOpenMenu(null);
        setUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", closeMenus);
    return () => document.removeEventListener("mousedown", closeMenus);
  }, []);

  const closeNavigation = () => {
    setOpenMenu(null);
    setMobileOpen(false);
  };

  return (
    <header ref={navRef} className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-black/95">
      <nav className="mx-auto flex h-16 max-w-[1600px] items-center gap-3 px-4 md:px-6" aria-label="Navegacion principal">
        <Link href={itemsHref} className="relative h-10 w-28 shrink-0" aria-label="Ir a items">
          <Image src={theme === "dark" ? "/imc-navbar-logo-negro.png" : "/imc-navbar-logo.png"} alt="IMC" fill className="object-contain object-left" priority />
        </Link>

        <div className="hidden h-full items-center gap-1 md:flex">
          {navGroups.map((group) => {
            const Icon = group.icon;
            const isOpen = openMenu === group.label;
            const active = isGroupActive(group);

            return (
              <div key={group.label} className="relative h-full">
                <button
                  type="button"
                  onClick={() => setOpenMenu(isOpen ? null : group.label)}
                  className={`flex h-full items-center gap-2 border-b-2 px-3 text-sm font-bold transition-colors ${active || isOpen ? "border-blue-600 text-slate-950 dark:text-white" : "border-transparent text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white"}`}
                  aria-expanded={isOpen}
                >
                  <Icon className="h-5 w-5" />
                  <span>{group.label}</span>
                  <HiChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>

                {isOpen && (
                  <div className="absolute left-0 top-[calc(100%-1px)] min-w-56 overflow-hidden border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-800 dark:bg-slate-950">
                    {group.links.map((link) => {
                      const itemClass = "flex w-full items-center px-4 py-2.5 text-left text-sm font-semibold transition-colors";
                      if (link.disabled) {
                        return <span key={link.label} className={`${itemClass} cursor-not-allowed text-slate-400 dark:text-slate-600`} title="Proximamente">{link.label}<span className="ml-auto text-[10px] font-bold uppercase">Proximamente</span></span>;
                      }
                      if (link.external && link.href) {
                        return <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" className={`${itemClass} text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white`}>{link.label}</a>;
                      }
                      return <Link key={link.label} href={link.href === "/" ? itemsHref : link.href || "#"} onClick={closeNavigation} className={`${itemClass} text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white`}>{link.label}</Link>;
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          <ThemeToggle />
          <div className="relative">
            <button type="button" onClick={() => setUserMenuOpen((open) => !open)} className="flex items-center gap-2 border border-slate-200 px-2 py-1.5 text-left transition-colors hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-900" aria-expanded={userMenuOpen}>
              <span className="flex h-8 w-8 items-center justify-center bg-slate-950 text-xs font-black text-white dark:bg-white dark:text-slate-950">{userProfile.initials}</span>
              <span className="max-w-32 truncate text-xs font-bold text-slate-900 dark:text-white">{userProfile.nombre}</span>
              <HiChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${userMenuOpen ? "rotate-180" : ""}`} />
            </button>
            {userMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-800 dark:bg-slate-950">
                <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-800"><p className="truncate text-sm font-bold text-slate-950 dark:text-white">{userProfile.nombre}</p><p className="text-xs text-slate-500">{userProfile.rol}</p></div>
                <LogoutButton className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" />
              </div>
            )}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <button type="button" onClick={() => setMobileOpen((open) => !open)} className="flex h-10 w-10 items-center justify-center border border-slate-200 text-slate-700 dark:border-slate-800 dark:text-slate-200" aria-label="Abrir navegacion" aria-expanded={mobileOpen}>
            {mobileOpen ? <HiX className="h-6 w-6" /> : <HiOutlineMenuAlt2 className="h-6 w-6" />}
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-black md:hidden">
          {navGroups.map((group) => {
            const Icon = group.icon;
            return (
              <div key={group.label} className="border-b border-slate-100 py-2 last:border-0 dark:border-slate-900">
                <div className="flex items-center gap-2 px-2 py-2 text-sm font-bold text-slate-950 dark:text-white"><Icon className="h-5 w-5" />{group.label}</div>
                <div className="ml-7 space-y-1">
                  {group.links.map((link) => link.disabled ? (
                    <span key={link.label} className="block px-2 py-2 text-sm text-slate-400">{link.label} (Proximamente)</span>
                  ) : link.external && link.href ? (
                    <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" className="block px-2 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300">{link.label}</a>
                  ) : (
                    <Link key={link.label} href={link.href === "/" ? itemsHref : link.href || "#"} onClick={closeNavigation} className="block px-2 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300">{link.label}</Link>
                  ))}
                </div>
              </div>
            );
          })}
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 px-2 pt-3 dark:border-slate-900"><div><p className="text-sm font-bold text-slate-950 dark:text-white">{userProfile.nombre}</p><p className="text-xs text-slate-500">{userProfile.rol}</p></div><LogoutButton className="w-auto text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" /></div>
        </div>
      )}
    </header>
  );
};
