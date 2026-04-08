"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "@/components/auth/LogoutButton";

const navLinks = [
  { href: "/", label: "Productos" },
  { href: "/piezas", label: "Piezas" },
  { href: "/marcas", label: "Marcas" },
  { href: "/proveedores", label: "Proveedores" },
  { href: "/categorias", label: "Categorías" },
];

export const Navbar = () => {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md px-4 py-3 shadow-sm md:px-8">
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

        <div className="hidden flex-1 items-center justify-center gap-1 md:flex">
          {navLinks.map((link) => {
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
        </div>

        <div className="flex shrink-0 items-center justify-end">
          <LogoutButton />
        </div>
      </div>
      {/* Mobile nav fallback */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2 md:hidden">
        {navLinks.map((link) => {
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
      </div>
    </nav>
  );
};
