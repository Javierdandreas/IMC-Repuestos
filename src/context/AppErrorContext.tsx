"use client";

import { createContext, ReactNode, useContext, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

type AppErrorState = {
  title: string;
  message: string;
  detail?: string;
} | null;

type AppErrorContextValue = {
  showError: (error: unknown, fallbackMessage?: string) => void;
  showMessage: (message: string, title?: string, detail?: string) => void;
};

const AppErrorContext = createContext<AppErrorContextValue | null>(null);

function getMessage(error: unknown, fallbackMessage = "Ocurrió un error") {
  if (typeof error === "string" && error.trim()) return error;
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error && "message" in error && typeof (error as any).message === "string") {
    return (error as any).message;
  }
  return fallbackMessage;
}

export function AppErrorProvider({ children }: { children: ReactNode }) {
  const [error, setError] = useState<AppErrorState>(null);

  const showMessage = (message: string, title = "No se pudo completar la acción", detail?: string) => {
    setError({ title, message, detail });
  };

  const showError = (value: unknown, fallbackMessage?: string) => {
    const message = getMessage(value, fallbackMessage);
    const detail = value instanceof Error && value.stack ? value.stack : undefined;
    showMessage(message, "No se pudo completar la acción", detail);
  };

  return (
    <AppErrorContext.Provider value={{ showError, showMessage }}>
      {children}
      {error && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={() => setError(null)} />
          <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-red-100 bg-white shadow-2xl dark:border-red-950 dark:bg-slate-950">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5 dark:border-slate-800">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white">{error.title}</h2>
                  <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300">{error.message}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setError(null)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {error.detail && process.env.NODE_ENV !== "production" && (
              <details className="border-b border-slate-100 px-5 py-3 text-xs dark:border-slate-800">
                <summary className="cursor-pointer font-bold text-slate-500">Detalle técnico</summary>
                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-3 text-[11px] text-slate-100">
                  {error.detail}
                </pre>
              </details>
            )}

            <div className="flex justify-end p-4">
              <button
                type="button"
                onClick={() => setError(null)}
                className="h-10 rounded-xl bg-slate-900 px-5 text-xs font-black uppercase tracking-widest text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </AppErrorContext.Provider>
  );
}

export function useAppError() {
  const context = useContext(AppErrorContext);
  if (!context) {
    throw new Error("useAppError must be used within AppErrorProvider");
  }
  return context;
}
