"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { SidebarProvider, useSidebar } from "@/context/SidebarContext";

type Props = {
  children: React.ReactNode;
};

// Internal Shell to consume the context
function AppShellInternal({ children }: Props) {
  const pathname = usePathname();
  const { isCollapsed } = useSidebar();
  const hideSidebar = pathname === "/login";

  if (hideSidebar) {
    return <main>{children}</main>;
  }

  return (
    <div className="flex min-h-screen bg-white dark:bg-slate-950">
      <Sidebar />
      <main 
        className={`flex-1 transition-all duration-300 ease-in-out ${
          isCollapsed ? "md:ml-20" : "md:ml-64"
        }`}
      >
        {/* Top Spacer for mobile toggle button area */}
        <div className="h-16 md:hidden" />
        <div className="p-4 md:p-0">
          {children}
        </div>
      </main>
    </div>
  );
}

export default function AppShell({ children }: Props) {
  return (
    <SidebarProvider>
       <AppShellInternal>{children}</AppShellInternal>
    </SidebarProvider>
  );
}
