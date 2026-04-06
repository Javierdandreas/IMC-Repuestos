import Image from "next/image";
import Link from "next/link";
import LogoutButton from "@/components/auth/LogoutButton";

const navLinks = [
  { href: "/", label: "Productos" },
  { href: "/piezas", label: "Piezas" },
  { href: "/marcas", label: "Marcas" },
  { href: "/proveedores", label: "Proveedores" },
  { href: "/categorias", label: "Categorías" },
];

export const Navbar = () => {
  return (
    <nav className="border-b border-gray-2000 bg-gray-200 px-4 py-4 shadow-sm md:px-6">
      <div className="mx-auto flex max-w-7xl items-center gap-4">
        <Link href="/" className="flex shrink-0 items-center">
          <Image
            src="/imc-navbar-logo.png"
            alt="IMC Repuestos"
            width={440}
            height={148}
            priority
            className="h-14 w-auto"
          />
        </Link>

        <div className="flex flex-1 flex-wrap items-center justify-center gap-2 md:gap-3">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-xl bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-700"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex shrink-0 items-center justify-end">
          <LogoutButton />
        </div>
      </div>
    </nav>
  );
};
