"use client";

import { ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { motion, Variants } from "framer-motion";

import {
  isSidebarHrefActive,
  navigationData,
} from "./sidebar-navigation";

type Props = {
  sectionId: string | null;
  onClose: () => void;
};

export function SidebarDrawer({ sectionId, onClose }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (!sectionId || !navigationData[sectionId]) return null;

  const data = navigationData[sectionId];

  const colorMap = {
    blue: {
      active: "text-blue-600 dark:text-blue-400",
      icon: "text-blue-500 dark:text-blue-400",
      badge: "bg-blue-500 text-white border-blue-400",
    },
    amber: {
      active: "text-amber-600 dark:text-amber-400",
      icon: "text-amber-500 dark:text-amber-400",
      badge: "bg-amber-500 text-white border-amber-400",
    },
    emerald: {
      active: "text-emerald-600 dark:text-emerald-400",
      icon: "text-emerald-500 dark:text-emerald-400",
      badge: "bg-emerald-500 text-white border-emerald-400",
    },
    indigo: {
      active: "text-indigo-600 dark:text-indigo-400",
      icon: "text-indigo-500 dark:text-indigo-400",
      badge: "bg-indigo-500 text-white border-indigo-400",
    },
    red: {
      active: "text-red-600 dark:text-red-400",
      icon: "text-red-500 dark:text-red-400",
      badge: "bg-red-500 text-white border-red-400",
    },
    slate: {
      active: "text-slate-900 dark:text-white",
      icon: "text-slate-500 dark:text-slate-400",
      badge: "bg-slate-800 text-white border-slate-700",
    },
  } as const;

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, x: -10 },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 25,
      },
    },
  };

  return (
    <div className="pointer-events-auto flex h-full w-[260px] flex-col border-r border-[#f1f1f2] bg-white shadow-[1px_0_10px_rgba(0,0,0,0.02)] dark:border-slate-900 dark:bg-slate-950">
      <div className="shrink-0 px-6 py-8 flex items-center justify-between">
        <motion.h2
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[18px] font-bold tracking-tight text-slate-900 dark:text-white"
        >
          {data.title}
        </motion.h2>
        <motion.button
          whileHover={{ scale: 1.1, rotate: 90 }}
          whileTap={{ scale: 0.9 }}
          onClick={onClose}
          className="rounded-xl p-1.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600 dark:hover:bg-slate-900 dark:hover:text-slate-300"
        >
          <X className="h-4 w-4" />
        </motion.button>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex-1 overflow-y-auto px-3 pb-6 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800"
      >
        {data.groups.map((group, groupIndex) => (
          <motion.div
            variants={itemVariants}
            key={groupIndex}
            className="mb-8 last:mb-0"
          >
            {group.label && (
              <h3 className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500">
                {group.label}
              </h3>
            )}

            <div className="space-y-0.5">
              {group.items.map((item, itemIndex) => {
                const Icon = item.icon;
                const colorKey =
                  item.color && item.color in colorMap ? item.color : "slate";
                const colors = colorMap[colorKey];
                const isExternal =
                  item.external ||
                  item.href.startsWith("http://") ||
                  item.href.startsWith("https://");
                const isActive = isSidebarHrefActive(
                  pathname,
                  searchParams,
                  item.href
                );

                const className = `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-all duration-300 hover:bg-slate-100/50 dark:hover:bg-slate-900/80 ${
                  isActive
                    ? colors.active
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`;

                const content = (
                  <>
                    {Icon && (
                      <div
                        className={`p-1 transition-all duration-300 ${
                          isActive ? "" : "group-hover:scale-110"
                        }`}
                      >
                        <Icon
                          className={`h-4 w-4 ${
                            isActive
                              ? colors.icon
                              : "text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300"
                          }`}
                        />
                      </div>
                    )}
                    <span className="flex-1 transition-transform duration-300 group-hover:translate-x-1">
                      {item.label}
                    </span>
                    {item.badge && (
                      <span
                        className={`rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase transition-all duration-300 group-hover:scale-110 ${
                          isActive
                            ? `${colors.badge} opacity-90`
                            : "border-slate-200 bg-slate-100 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                    <ChevronRight
                      className={`h-3 w-3 transition-all duration-300 ${
                        isActive
                          ? "translate-x-0 opacity-100 text-slate-400"
                          : "-translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100"
                      }`}
                    />
                  </>
                );

                if (isExternal) {
                  return (
                    <a
                      key={itemIndex}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={onClose}
                      className={className}
                    >
                      {content}
                    </a>
                  );
                }

                return (
                  <Link
                    key={itemIndex}
                    href={item.href}
                    onClick={onClose}
                    className={className}
                  >
                    {content}
                  </Link>
                );
              })}
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
