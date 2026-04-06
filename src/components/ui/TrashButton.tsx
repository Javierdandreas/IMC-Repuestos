"use client";

import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from "react";
import Link from "next/link";

type CommonProps = {
  label: string;
  className?: string;
  children?: ReactNode;
};

function TrashIcon() {
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
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

export function TrashButton({
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
      className={`inline-flex h-9 w-9 items-center justify-center rounded-md border border-red-200 text-red-600 transition hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60 ${className}`.trim()}
      {...props}
    >
      {children ?? <TrashIcon />}
    </button>
  );
}

export function TrashLink({
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
      className={`inline-flex h-9 w-9 items-center justify-center rounded-md border border-red-200 text-red-600 transition hover:bg-red-50 hover:text-red-700 ${className}`.trim()}
      {...props}
    >
      {children ?? <TrashIcon />}
    </Link>
  );
}
