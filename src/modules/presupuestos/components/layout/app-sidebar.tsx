"use client";

import Link from "next/link";
import {
  BarChart3,
  CheckSquare,
  ClipboardList,
  FolderOpen,
  Globe,
  Home,
  Settings,
} from "lucide-react";
import { usePathname } from "next/navigation";

type Props = {
  open: boolean;
  onNavigate?: () => void;
};

const items = [
  { label: "Inicio", href: "/presupuestos/nuevo", icon: Home },
  { label: "General", href: "/presupuestos/general", icon: ClipboardList },
  { label: "Pendientes", href: "/presupuestos/pendientes", icon: FolderOpen },
  { label: "Confirmados", href: "/presupuestos/confirmados", icon: CheckSquare },
  { label: "Estadísticas", href: "/presupuestos/estadisticas", icon: BarChart3 },
  { label: "Base de Datos", href: "https://imc-repuestos.vercel.app/", icon: Globe },
];

export function AppSidebar({ open, onNavigate }: Props) {
  const pathname = usePathname();

  return (
    <aside
      className="transition-smooth h-full flex flex-col"
      style={{
        width: open ? "var(--sidebar-width-open)" : "var(--sidebar-width-closed)",
        background: "var(--sidebar-bg)",
        borderRight: "1px solid var(--border-light)",
      }}
    >
      {/* Navigation */}
      <nav className="flex-1 px-4 pt-8 space-y-2 overflow-y-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`transition-smooth group flex items-center gap-3 rounded-full px-3 py-3 text-[14px] font-semibold ${active
                ? "text-white shadow-[0_4px_12px_rgba(59,130,246,0.25)]"
                : "text-[var(--sidebar-text)] hover:bg-[var(--bg-body)] hover:text-[var(--sidebar-text-hover)]"
                }`}
              style={{
                background: active ? "var(--sidebar-active-bg)" : "transparent",
                justifyContent: open ? "flex-start" : "center",
              }}
            >
              <div className={`flex items-center justify-center ${active ? '' : 'text-[var(--sidebar-text)] opacity-80'}`}>
                <Icon
                  className="shrink-0"
                  style={{ width: 20, height: 20 }}
                />
              </div>
              {open && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="shrink-0 px-4 py-6 border-t border-[var(--border-light)]">
        <div className="flex items-center justify-center">
          <p className="text-[11px] font-medium text-[var(--sidebar-text)] opacity-60">
            {open ? "IMC Cerebro v1.0" : "v1"}
          </p>
        </div>
      </div>
    </aside>
  );
}
