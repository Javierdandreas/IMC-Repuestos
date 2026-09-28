"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";

type Props = { children: React.ReactNode };

export default function AppShell({ children }: Props) {
  const pathname = usePathname();
  if (pathname === "/login") return <main>{children}</main>;

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <Sidebar />
      <main>{children}</main>
    </div>
  );
}
