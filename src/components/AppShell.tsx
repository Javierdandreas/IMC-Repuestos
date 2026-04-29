"use client";

import { usePathname } from "next/navigation";
import { DashboardShell } from "@/modules/presupuestos/components/layout/dashboard-shell";

type Props = {
  children: React.ReactNode;
};

export default function AppShell({ children }: Props) {
  const pathname = usePathname();
  
  // No mostrar sidebar ni header en el login
  const isLoginPage = pathname === "/login";

  if (isLoginPage) {
    return <main className="min-h-screen bg-slate-50 dark:bg-slate-950">{children}</main>;
  }

  return (
    <DashboardShell>
      {children}
    </DashboardShell>
  );
}
