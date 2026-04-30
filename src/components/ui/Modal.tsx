"use client";

import { ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useScrollLock } from "@/hooks/use-scroll-lock";

type Props = {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  headerExtra?: ReactNode;
  headerActions?: ReactNode;
  width?: string;
};

export function Modal({ title, open, onClose, children, headerExtra, headerActions, width = "w-[min(96vw,1280px)]" }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useScrollLock(open);

  useEffect(() => {
    if (!open) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleEscape);
    
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop con blur mejorado */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-md transition-opacity dark:bg-black/60" 
        onClick={onClose} 
      />
      
      {/* Modal Container */}
      <div className={`relative z-10 flex max-h-[92vh] ${width} flex-col overflow-hidden rounded-3xl border border-slate-200/60 bg-white shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] dark:border-slate-800 dark:bg-slate-950 dark:shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] animate-in zoom-in-95 duration-200`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800/60">
          <div className="flex flex-1 items-center gap-6">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{title}</h2>
            {headerExtra}
          </div>

          <div className="flex items-center gap-4">
            {headerActions}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:bg-slate-900 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-0 flex-1">{children}</div>
      </div>
    </div>,
    document.body
  );
}
