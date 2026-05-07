"use client";

import { useEffect, useRef, useState } from "react";
import { AppHeader } from "@/modules/presupuestos/components/layout/app-header";
import { SidebarRail } from "@/modules/presupuestos/components/layout/sidebar-rail";
import { SidebarDrawer } from "@/modules/presupuestos/components/layout/sidebar-drawer";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const pathname = usePathname();
  const mainRef = useRef<HTMLElement | null>(null);

  // Close drawer on navigation
  useEffect(() => {
    setActiveSection(null);
    if (mainRef.current) {
      mainRef.current.scrollTo(0, 0);
    }
  }, [pathname]);

  return (
    <div className="h-[100dvh] w-full flex overflow-hidden bg-white dark:bg-slate-950 selection:bg-blue-100 selection:text-blue-900 relative print:h-auto print:overflow-visible">
      {/* Premium Background Mesh Glow - Optimized with GPU acceleration */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden transform-gpu">
        <div className="absolute -top-[10%] -right-[10%] w-[40%] h-[40%] bg-blue-50/50 dark:bg-blue-950/20 blur-[120px] rounded-full transform-gpu will-change-transform" />
        <div className="absolute -bottom-[10%] -left-[10%] w-[40%] h-[40%] bg-slate-100/50 dark:bg-slate-900/20 blur-[120px] rounded-full transform-gpu will-change-transform" />
      </div>

      {/* Sidebar Wrapper for Hover Control */}
      <div
        className="flex h-full relative print:hidden"
        onMouseLeave={() => setActiveSection(null)}
      >
        {/* 1. Primary Sidebar (Rail) */}
        <SidebarRail
          activeId={activeSection}
          onSelect={(id) => setActiveSection(id)}
          onHover={(id) => setActiveSection(id)}
        />

        {/* 2. Secondary Sidebar (Drawer) */}
        <AnimatePresence>
          {activeSection && (
            <motion.div
              initial={{ x: -20, opacity: 0, filter: "blur(10px)" }}
              animate={{ x: 0, opacity: 1, filter: "blur(0px)" }}
              exit={{ x: -20, opacity: 0, filter: "blur(10px)" }}
              transition={{ 
                type: "spring", 
                damping: 25, 
                stiffness: 200, 
                mass: 0.8
              }}
              className="absolute left-[72px] top-0 h-full z-50 shadow-[20px_0_60px_rgba(0,0,0,0.05)] dark:shadow-[20px_0_60px_rgba(0,0,0,0.2)]"
            >
              <SidebarDrawer
                sectionId={activeSection}
                onClose={() => setActiveSection(null)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 3. Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 relative bg-[#fbfbfb] dark:bg-slate-950">
        {/* Header */}
        <div className="print:hidden">
          <AppHeader
            onToggleSidebar={() => setActiveSection("operaciones")}
            onSelectSection={(id) => setActiveSection(id)}
          />
        </div>

        {/* Content Area - Hardware Accelerated Scroll */}
        <main
          id="main-content-area"
          ref={mainRef}
          className="flex-1 overflow-y-auto px-4 py-6 md:px-6 lg:px-8 lg:py-8 transform-gpu [backface-visibility:hidden] print:overflow-visible print:p-0 print:m-0"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="mx-auto max-w-[1600px]"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
