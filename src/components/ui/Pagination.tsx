"use client";

import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";

interface PaginationProps {
  totalPages: number;
}

export function Pagination({ totalPages }: PaginationProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentPage = Number(searchParams.get("page")) || 1;

  const createPageURL = (pageNumber: number | string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", pageNumber.toString());
    return `${pathname}?${params.toString()}`;
  };

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2 mt-6 p-4">
      <Link
        href={createPageURL(currentPage - 1)}
        className={`px-4 py-2 border border-slate-200 rounded-xl font-bold text-sm bg-white text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 ${
          currentPage <= 1 ? "pointer-events-none opacity-50" : ""
        }`}
        aria-disabled={currentPage <= 1}
      >
        Anterior
      </Link>

      <span className="text-sm font-bold text-slate-500 px-4 dark:text-slate-500">
        Página <span className="text-slate-900 dark:text-white">{currentPage}</span> / {totalPages}
      </span>

      <Link
        href={createPageURL(currentPage + 1)}
        className={`px-4 py-2 border border-slate-200 rounded-xl font-bold text-sm bg-white text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 ${
          currentPage >= totalPages ? "pointer-events-none opacity-50" : ""
        }`}
        aria-disabled={currentPage >= totalPages}
      >
        Siguiente
      </Link>
    </div>
  );
}
