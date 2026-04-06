"use client";

import { ReactNode, useEffect } from "react";

type Props = {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

export function Modal({ title, open, onClose, children }: Props) {
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
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative z-10 flex max-h-[92vh] w-[min(96vw,1280px)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-xl font-bold">{title}</h2>

          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}
