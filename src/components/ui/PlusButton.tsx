"use client";

import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from "react";
import Link from "next/link";

type CommonProps = {
  label: string;
  className?: string;
  children?: ReactNode;
};

function PlusIcon() {
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
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

export function PlusButton({
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
      className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 text-slate-500 transition hover:bg-emerald-50 hover:text-emerald-600 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-400 ${className}`.trim()}
      {...props}
    >
      {children ?? <PlusIcon />}
    </button>
  );
}

export function PlusLink({
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
      className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 text-slate-500 transition hover:bg-emerald-50 hover:text-emerald-600 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-400 ${className}`.trim()}
      {...props}
    >
      {children ?? <PlusIcon />}
    </Link>
  );
}
