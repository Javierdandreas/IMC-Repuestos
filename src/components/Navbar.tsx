"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "@/components/auth/LogoutButton";
import { HiChevronDown } from "react-icons/hi";

const mainNavLinks = [
  { href: "/", label: "Productos" },
  { href: "/piezas", label: "Piezas" },
];

const catalogLinks = [
  { href: "/marcas", label: "Marcas" },
  { href: "/proveedores", label: "Proveedores" },
  { href: "/categorias", label: "Categorías" },
];

export const Navbar = () => {
  const pathname = usePathname();
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsCatalogOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close dropdown when path changes
  useEffect(() => {
    setIsCatalogOpen(false);
  }, [pathname]);

  const isCatalogActive = catalogLinks.some(link => pathname === link.href);

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md px-4 py-3 shadow-sm md:px-8">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-6">
        <Link href="/" className="flex shrink-0 items-center transition hover:opacity-80">
          <Image
            src="/imc-navbar-logo.png"
            alt="IMC Repuestos"
            width={440}
            height={148}
            priority
            className="h-10 w-auto"
          />
        </Link>

        {/* Desktop Nav */}
        <div className="hidden flex-1 items-center justify-center gap-1 md:flex">
          {mainNavLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {link.label}
              </Link>
            );
          })}

          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsCatalogOpen(!isCatalogOpen)}
              onMouseEnter={() => setIsCatalogOpen(true)}
              className={`flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                isCatalogActive || isCatalogOpen
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              Catálogos
              <HiChevronDown className={`h-4 w-4 transition-transform duration-200 ${isCatalogOpen ? "rotate-180" : ""}`} />
            </button>

            {isCatalogOpen && (
              <div 
                onMouseLeave={() => setIsCatalogOpen(false)}
                className="absolute left-1/2 mt-2 w-48 -translate-x-1/2 animate-in fade-in zoom-in duration-200 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl ring-1 ring-slate-900/5"
              >
                {catalogLinks.map((link) => {
                  const isActive = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`block rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                        isActive
                          ? "bg-slate-900 text-white"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end">
          <LogoutButton />
        </div>
      </div>

      {/* Mobile Nav */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2 md:hidden">
        {mainNavLinks.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                isActive
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
        {catalogLinks.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                isActive
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
