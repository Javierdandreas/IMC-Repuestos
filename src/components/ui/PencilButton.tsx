"use client";

import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from "react";
import Link from "next/link";

type CommonProps = {
  label: string;
  className?: string;
  children?: ReactNode;
};

function PencilIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
    </svg>
  );
}

export function PencilButton({
  label,
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & CommonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 text-slate-500 transition hover:bg-amber-50 hover:text-amber-600 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-amber-500/10 dark:hover:text-amber-400 ${className}`.trim()}
      {...props}
    >
      {children ?? <PencilIcon />}
    </button>
  );
}

export function PencilLink({
  label,
  href,
  className = "",
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & CommonProps & { href: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 text-slate-500 transition hover:bg-amber-50 hover:text-amber-600 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-amber-500/10 dark:hover:text-amber-400 ${className}`.trim()}
      {...props}
    >
      {children ?? <PencilIcon />}
    </Link>
  );
}
