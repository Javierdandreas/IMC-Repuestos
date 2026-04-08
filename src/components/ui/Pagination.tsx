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
        className={`px-4 py-2 border rounded-md font-medium transition hover:bg-slate-50 ${
          currentPage <= 1 ? "pointer-events-none opacity-50" : ""
        }`}
        aria-disabled={currentPage <= 1}
      >
        Anterior
      </Link>

      <span className="text-sm font-medium text-slate-600 px-4">
        Página {currentPage} de {totalPages}
      </span>

      <Link
        href={createPageURL(currentPage + 1)}
        className={`px-4 py-2 border rounded-md font-medium transition hover:bg-slate-50 ${
          currentPage >= totalPages ? "pointer-events-none opacity-50" : ""
        }`}
        aria-disabled={currentPage >= totalPages}
      >
        Siguiente
      </Link>
    </div>
  );
}
