"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  HiChevronDown, 
  HiOutlineCube, 
  HiOutlineShoppingCart, 
  HiOutlineUsers, 
  HiOutlineLibrary,
  HiOutlineMenuAlt2,
  HiX,
  HiChevronLeft,
  HiChevronRight
} from "react-icons/hi";
import { ThemeToggle } from "./ThemeToggle";
import LogoutButton from "@/modules/auth/components/LogoutButton";
import { useSidebar } from "@/context/SidebarContext";
import { useTheme } from "@/context/ThemeContext";
import { createClient } from "@/utils/supabase/client";

interface NavLink {
  href: string;
  label: string;
  external?: boolean;
  sublinks?: NavLink[];
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
      { 
        href: "/operaciones?tipo=VENTA", 
        label: "Ventas",
        sublinks: [
            { href: "/operaciones?tipo=VENTA", label: "Listado de Ventas" },
            { href: "https://imc-cerebro.vercel.app/", label: "Presupuestos", external: true },
        ]
      },
      { href: "/operaciones?tipo=AJUSTE", label: "Ajustes de Stock" },
    ],
  },
  {
    label: "Inventario",
    icon: HiOutlineCube,
    links: [
      { href: "/", label: "Items" },
      { href: "/piezas", label: "Piezas" },
      { href: "/kits", label: "Kits" },
    ],
  },
  {
    label: "Gestión",
    icon: HiOutlineLibrary,
    links: [
      { href: "/importaciones", label: "Importaciones" },
      { href: "/marcas", label: "Marcas" },
      { href: "/categorias", label: "Categorías" },
      { href: "/ubicaciones", label: "Ubicaciones" },
    ],
  },
  {
    label: "Entidades",
    icon: HiOutlineUsers,
    links: [
      { href: "#", label: "Clientes" },
      { href: "/proveedores", label: "Proveedores" },
    ],
  },
];

export const Sidebar = () => {
  const pathname = usePathname();
  const { isCollapsed, toggleSidebar } = useSidebar();
  const { theme } = useTheme();
  const [isHovered, setIsHovered] = useState(false);
  
  // El sidebar está "expandido visualmente" si no está colapsado manualmente O si se está pasando el mouse
  const isSidebarExpanded = !isCollapsed || isHovered;

  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [openSubgroups, setOpenSubgroups] = useState<Record<string, boolean>>({});
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    nombre: "Cargando...",
    rol: "Admin",
    initials: "??"
  });

  const isLinkActive = useCallback((href: string) => {
    if (href === "/" && pathname === "/") return true;
    if (href !== "/" && href !== "#" && pathname.startsWith(href)) return true;
    return false;
  }, [pathname]);

  useEffect(() => {
    navGroups.forEach(group => {
      const hasActive = group.links.some(link => 
        isLinkActive(link.href) || link.sublinks?.some(sub => isLinkActive(sub.href))
      );
      if (hasActive) {
        setActiveGroup(group.label);
        group.links.forEach(link => {
            if (link.sublinks?.some(sub => isLinkActive(sub.href))) {
                setOpenSubgroups(prev => ({ ...prev, [link.label]: true }));
            }
        });
      }
    });
  }, [pathname, isLinkActive]);

  useEffect(() => {
    const fetchUserProfile = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data: authData } = await supabase
          .from('usuario_auth')
          .select('rol, usuario:usuario_id(nombre_usuario)')
          .eq('auth_user_id', user.id)
          .single();

        if (authData) {
          const nombre = (authData.usuario as any)?.nombre_usuario || "Usuario";
          const rol = authData.rol || "Administrador";
          
          // Get initials
          const initials = nombre
            .split(" ")
            .map((n: string) => n[0])
            .join("")
            .toUpperCase()
            .substring(0, 2);

          setUserProfile({ nombre, rol, initials });
        }
      }
    };

    fetchUserProfile();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleGroup = (label: string) => {
    if (!isSidebarExpanded) {
        // Si estaba colapsado y hacemos clic, forzamos expansión visual (aunque el hover ya lo hace)
        setIsHovered(true);
    }
    setActiveGroup(prev => prev === label ? null : label);
  };

  const toggleSubgroup = (e: React.MouseEvent, label: string) => {
      e.preventDefault();
      e.stopPropagation();
      setOpenSubgroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <>
      {!isMobileOpen && (
        <button 
          onClick={() => setIsMobileOpen(true)}
          className="fixed top-4 left-4 z-40 rounded-xl bg-white p-2 shadow-lg dark:bg-slate-900 md:hidden border border-slate-200 dark:border-slate-800"
        >
          <HiOutlineMenuAlt2 className="h-6 w-6 text-slate-600 dark:text-slate-300" />
        </button>
      )}

      <AnimatePresence>
        {isMobileOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileOpen(false)}
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm md:hidden"
          />
        )}
      </AnimatePresence>

      <aside 
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`fixed top-0 left-0 z-50 h-screen border-r border-slate-300 bg-white transition-all duration-300 ease-in-out dark:border-slate-800 dark:bg-black/95 backdrop-blur-xl flex flex-col shadow-2xl md:shadow-none ${
          isMobileOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0'
        } ${!isSidebarExpanded && !isMobileOpen ? 'md:w-20' : 'md:w-64'}`}
      >
        
        {/* Logo Section */}
        <div className="flex h-24 items-center justify-center px-4 overflow-hidden border-b border-slate-100 dark:border-slate-800/50">
          <Link href="/" className="flex items-center justify-center w-full">
             <div className="relative w-full h-12">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${isCollapsed}-${theme}`}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.2 }}
                    className="relative w-full h-12"
                  >
                    <Image
                      src={
                        !isSidebarExpanded && !isMobileOpen
                          ? "/Logo_Plegado.png"
                          : theme === "dark" 
                            ? "/imc-navbar-logo-negro.png" 
                            : "/imc-navbar-logo.png"
                      }
                      alt="IMC Logo"
                      fill
                      className="object-contain"
                      priority
                    />
                  </motion.div>
                </AnimatePresence>
             </div>
          </Link>
          
          {/* Collapse Toggle Button (Desktop) */}
          <button 
            onClick={toggleSidebar}
            className="hidden md:flex absolute -right-3 top-10 z-50 h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            title={isCollapsed ? "Expandir sidebar" : "Colapsar sidebar"}
          >
            {isCollapsed ? <HiChevronRight className="h-4 w-4" /> : <HiChevronLeft className="h-4 w-4" />}
          </button>

          <button onClick={() => setIsMobileOpen(false)} className="absolute right-2 rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 md:hidden">
            <HiX className="h-6 w-6" />
          </button>
        </div>

        {/* Navigation Section */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-2 scrollbar-none scroll-smooth">
          {navGroups.map((group) => {
            const Icon = group.icon;
            const isOpen = activeGroup === group.label;
            
            return (
              <div key={group.label} className="space-y-1">
                <button
                  onClick={() => toggleGroup(group.label)}
                  title={isCollapsed ? group.label : ""}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-bold transition-all ${
                    isOpen && (!isCollapsed || isMobileOpen)
                      ? "bg-slate-100 text-slate-900 dark:bg-slate-900/40 dark:text-white ring-1 ring-slate-200 dark:ring-slate-800" 
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900/40 dark:hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <AnimatePresence>
                      {isSidebarExpanded && (
                        <motion.span
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          className="whitespace-nowrap"
                        >
                          {group.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                  {isSidebarExpanded && (
                    <HiChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                  )}
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && isSidebarExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="ml-5 mt-1 space-y-1 border-l border-slate-300 dark:border-slate-800/50 pl-4">
                        {group.links.map((link) => {
                          const active = isLinkActive(link.href) && !link.sublinks;
                          const hasSublinks = link.sublinks && link.sublinks.length > 0;
                          const isSubOpen = openSubgroups[link.label];

                          return (
                            <div key={link.href} className="space-y-1">
                                {hasSublinks ? (
                                    <>
                                        <button 
                                            onClick={(e) => toggleSubgroup(e, link.label)}
                                            className={`flex w-full items-center justify-between rounded-lg py-2.5 px-3 text-xs font-bold transition-all ${
                                                isSubOpen ? "text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
                                            }`}
                                        >
                                            <span className="truncate">{link.label}</span>
                                            <HiChevronDown className={`h-3 w-3 transition-transform duration-200 ${isSubOpen ? "rotate-180" : ""}`} />
                                        </button>
                                        <AnimatePresence>
                                            {isSubOpen && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="ml-2 border-l border-slate-300 dark:border-slate-800/50 pl-3 space-y-1"
                                                >
                                                    {link.sublinks?.map(sub => (
                                                        sub.external ? (
                                                            <a 
                                                                key={sub.href}
                                                                href={sub.href}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="block py-2 text-[11px] font-semibold text-slate-500 hover:text-blue-600 transition-colors"
                                                            >
                                                                {sub.label}
                                                            </a>
                                                        ) : (
                                                            <Link
                                                                key={sub.href}
                                                                href={sub.href}
                                                                className={`block py-2 text-[11px] font-semibold transition-all ${
                                                                    isLinkActive(sub.href) ? "text-blue-600 dark:text-blue-400" : "text-slate-500 hover:text-slate-900"
                                                                }`}
                                                            >
                                                                {sub.label}
                                                            </Link>
                                                        )
                                                    ))}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </>
                                ) : (
                                    link.external ? (
                                        <a
                                          href={link.href}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="block py-2.5 px-3 text-xs font-semibold text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors"
                                        >
                                          {link.label}
                                        </a>
                                      ) : (
                                        <Link
                                          href={link.href}
                                          className={`block py-2.5 px-3 text-xs font-semibold transition-all ${
                                            active
                                              ? "text-blue-600 dark:text-blue-400"
                                              : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                                          }`}
                                        >
                                          {link.label}
                                        </Link>
                                      )
                                )}
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </nav>

        {/* Footer Section */}
        <div className="mt-auto p-4 space-y-4 border-t border-slate-100 dark:border-slate-800/50">
           
           {/* User Section with Popover */}
           <div className="relative" ref={userMenuRef}>
             <AnimatePresence>
                {userMenuOpen && (
                    <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute bottom-full left-0 mb-2 w-full min-w-[180px] overflow-hidden rounded-2xl bg-white p-1.5 shadow-2xl ring-1 ring-slate-300 dark:bg-slate-900 dark:ring-slate-800"
                    >
                        <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{userProfile.nombre}</p>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-black">{userProfile.rol}</p>
                        </div>
                        <LogoutButton 
                            className="text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl" 
                        />
                    </motion.div>
                )}
             </AnimatePresence>

             <button 
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className={`flex w-full items-center gap-3 rounded-2xl p-2 transition-all hover:bg-slate-50 dark:hover:bg-slate-900/50 ${userMenuOpen ? 'bg-slate-100 dark:bg-slate-900/50' : ''} ${!isSidebarExpanded && !isMobileOpen ? 'justify-center' : ''}`}
             >
                <div className="relative h-9 w-9 flex-shrink-0">
                    <div className="flex h-full w-full items-center justify-center rounded-xl bg-slate-950 dark:bg-white text-white dark:text-slate-950 text-xs font-black shadow-lg">
                        {userProfile.initials}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-green-500 dark:border-black" />
                </div>
                
                <AnimatePresence>
                    {isSidebarExpanded && (
                        <motion.div 
                            initial={{ opacity: 0, width: 0 }}
                            animate={{ opacity: 1, width: "auto" }}
                            exit={{ opacity: 0, width: 0 }}
                            className="flex flex-1 items-center justify-between overflow-hidden text-left"
                        >
                            <div className="truncate">
                                <p className="text-xs font-black text-slate-900 dark:text-white leading-tight truncate">{userProfile.nombre}</p>
                                <p className="text-[10px] text-slate-500 font-bold leading-tight">{userProfile.rol}</p>
                            </div>
                            <HiChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                        </motion.div>
                    )}
                </AnimatePresence>
             </button>
           </div>

           {/* Theme Section - Now centered and without collapse button */}
           <div className={`flex items-center justify-center p-1.5 rounded-2xl bg-slate-50 dark:bg-slate-910/30 border border-slate-200 dark:border-slate-800/50`}>
             <ThemeToggle />
           </div>
        </div>
        
      </aside>
    </>
  );
};
