"use client";

import Link from "next/link";
import { Settings } from "lucide-react";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";

import { useUsuarioPresupuestosActual } from "@/lib/presupuestos/auth-storage";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

import {
  getSidebarSectionForPath,
  railItems,
} from "./sidebar-navigation";

type Props = {
  activeId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string) => void;
};

export function SidebarRail({ activeId, onSelect, onHover }: Props) {
  const pathname = usePathname();
  const currentSection = getSidebarSectionForPath(pathname);
  const { usuarioActual } = useUsuarioPresupuestosActual();
  const initials = usuarioActual?.nombre?.substring(0, 2).toUpperCase() || "AD";

  return (
    <aside className="z-50 flex h-full w-[72px] shrink-0 flex-col items-center border-r border-[#f1f1f2] bg-white py-6 dark:border-slate-900 dark:bg-slate-950">
      <div className="group mb-8 p-1">
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="relative h-11 w-11 cursor-pointer overflow-hidden rounded-full border-2 border-white bg-slate-900 shadow-md transition-all group-hover:ring-2 group-hover:ring-slate-900/10 dark:border-slate-800 dark:bg-white dark:group-hover:ring-white/10"
        >
          <div className="flex h-full w-full items-center justify-center text-[11px] font-bold text-white dark:text-slate-950">
            {initials}
          </div>
          <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-950" />
        </motion.div>
      </div>

      <nav className="flex flex-1 flex-col items-center gap-4">
        {railItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            activeId === item.id || (!activeId && currentSection === item.id);

          const content = (
            <>
              <Icon strokeWidth={isActive ? 2.5 : 1.5} className="relative z-10 h-6 w-6" />

              {isActive && (
                <motion.div
                  layoutId="activeRailIndicator"
                  className="absolute -left-[14px] h-6 w-1.5 rounded-r-full bg-[var(--color-info)]"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}

              <span className="pointer-events-none absolute left-[64px] origin-left scale-0 whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-[11px] font-bold text-white shadow-lg transition-transform group-hover:scale-100 dark:bg-slate-700">
                {item.label}
              </span>
            </>
          );

          const className = `group relative flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-300 ${
            isActive
              ? "bg-[var(--color-info-bg)] text-[var(--color-info)] shadow-[0_0_15px_rgba(59,130,246,0.1)] dark:bg-blue-500/10"
              : "text-slate-400 hover:bg-slate-50 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-900 dark:hover:text-slate-300"
          }`;

          if (item.href) {
            return (
              <motion.div key={item.id} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                <Link
                  href={item.href}
                  onClick={() => onSelect(item.id)}
                  onMouseEnter={() => onHover(item.id)}
                  className={className}
                  title={item.label}
                >
                  {content}
                </Link>
              </motion.div>
            );
          }

          return (
            <motion.button
              key={item.id}
              onClick={() => onSelect(item.id)}
              onMouseEnter={() => onHover(item.id)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className={className}
              title={item.label}
            >
              {content}
            </motion.button>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col items-center gap-4">
        <ThemeToggle />
        <motion.div
          whileHover={{ scale: 1.1, rotate: 15 }}
          className="opacity-20 transition-opacity hover:opacity-100"
        >
          <Settings className="h-5 w-5 cursor-pointer text-slate-400 dark:text-slate-500" />
        </motion.div>
      </div>
    </aside>
  );
}
