"use client";

import { ReactNode, useEffect } from "react";

type Props = {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  headerExtra?: ReactNode;
  headerActions?: ReactNode;
  width?: string;
  hideHeaderBorder?: boolean;
};

export function Modal({ title, open, onClose, children, headerExtra, headerActions, width = "w-[min(96vw,1280px)]", hideHeaderBorder = false }: Props) {
  useEffect(() => {
    if (!open) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "auto";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity dark:bg-black/60" onClick={onClose} />
      <div className={`relative z-10 flex max-h-[92vh] ${width} flex-col overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950`}>
        <div className={`flex items-center justify-between px-6 py-4 ${hideHeaderBorder ? "" : "border-b border-slate-100 dark:border-slate-800/60"}`}>
          <div className="flex flex-1 items-center gap-6">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{title}</h2>
            {headerExtra}
          </div>

          <div className="flex items-center gap-4">
            {headerActions}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-0">{children}</div>
      </div>
    </div>
  );
}
