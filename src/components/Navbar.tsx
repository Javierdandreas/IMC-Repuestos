"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "@/modules/auth/components/LogoutButton";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { HiChevronDown } from "react-icons/hi";
import { motion, AnimatePresence } from "framer-motion";

interface NavLink {
  href: string;
  label: string;
}

interface NavGroup {
  label: string;
  links: NavLink[];
}

const navGroups: NavGroup[] = [
  {
    label: "Operaciones",
    links: [
      { href: "/operaciones?tipo=COMPRA", label: "Compras" },
      { href: "/operaciones?tipo=VENTA", label: "Ventas" },
      { href: "/operaciones?tipo=AJUSTE", label: "Ajustes de Stock" },
    ],
  },
  {
    label: "Ítems",
    links: [
      { href: "/", label: "Catálogo Productos" },
      { href: "/piezas", label: "Piezas / Componentes" },
      { href: "/importaciones", label: "Historial Importaciones" },
    ],
  },
  {
    label: "Entidades",
    links: [
      { href: "/proveedores", label: "Proveedores" },
      { href: "#", label: "Clientes (Próximamente)" },
    ],
  },
  {
    label: "Listados",
    links: [
      { href: "/marcas", label: "Marcas" },
      { href: "/categorias", label: "Categorías" },
      { href: "/ubicaciones", label: "Ubicaciones" },
    ],
  },
];

export const Navbar = () => {
  const pathname = usePathname();
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setActiveDropdown(null);
  }, [pathname]);

  const isGroupActive = (group: NavGroup) => {
    return group.links.some(link => pathname === link.href || (pathname === "/" && link.href === "/"));
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-black backdrop-blur-md px-4 py-3 shadow-sm md:px-8">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-6" ref={navRef}>
        <Link href="/" className="flex shrink-0 items-center transition hover:opacity-80">
          <Image
            src="/imc-navbar-logo.png"
            alt="IMC Repuestos"
            width={440}
            height={148}
            priority
            className="h-10 w-auto dark:hidden"
          />
          <Image
            src="/imc-navbar-logo-negro.png"
            alt="IMC Repuestos"
            width={440}
            height={148}
            priority
            className="hidden h-10 w-auto dark:block"
          />
        </Link>

        {/* Desktop Nav */}
        <div className="hidden flex-1 items-center justify-center gap-2 md:flex">
          {navGroups.map((group) => (
            <div key={group.label} className="relative group/nav">
              <button
                onClick={() => setActiveDropdown(activeDropdown === group.label ? null : group.label)}
                onMouseEnter={() => setActiveDropdown(group.label)}
                className={`flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-bold transition-all duration-200 ${
                  activeDropdown === group.label || isGroupActive(group)
                    ? "bg-slate-100 text-slate-900 dark:bg-slate-900 dark:text-white"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white"
                }`}
              >
                {group.label}
                <HiChevronDown className={`h-4 w-4 transition-transform duration-200 ${activeDropdown === group.label ? "rotate-180" : ""}`} />
              </button>

              <AnimatePresence>
                {activeDropdown === group.label && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    onMouseLeave={() => setActiveDropdown(null)}
                    className="absolute left-1/2 mt-2 w-56 -translate-x-1/2 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl ring-1 ring-slate-900/5 dark:border-slate-800 dark:bg-slate-900 dark:ring-white/5"
                  >
                    {group.links.map((link) => {
                      const isActive = pathname === link.href;
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          className={`block rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
                            isActive
                              ? "bg-slate-900 text-white shadow-lg dark:bg-white dark:text-slate-900"
                              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                          }`}
                        >
                          {link.label}
                        </Link>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-3">
          <Link
            href="https://imc-cerebro.vercel.app/"
            rel="noopener noreferrer"
            className="hidden items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-900 transition-all hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 lg:flex"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500"></span>
            </span>
            Presupuestos
          </Link>
          <ThemeToggle />
          <LogoutButton />
        </div>
      </div>

      {/* Mobile Nav */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2 md:hidden">
        {navGroups.map((group) => (
           <div key={`mobile-${group.label}`} className="contents">
              {group.links.map((link) => {
                if (link.href === "#") return null;
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={`mob-${link.href}`}
                    href={link.href}
                    className={`rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-tight transition-all ${
                      isActive
                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                        : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
           </div>
        ))}
      </div>
    </nav>
  );
};
