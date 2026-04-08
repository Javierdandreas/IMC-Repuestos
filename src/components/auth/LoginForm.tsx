"use client";

import { useSearchParams } from "next/navigation";
import { FormEvent, useState, useEffect } from "react";

export default function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [maxCountdown, setMaxCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json().catch(() => ({}));
      if (response.status === 429) {
        const seconds = data.retryAfterSeconds || 60;
        setCountdown(seconds);
        setMaxCountdown(seconds);
        setError("");
        return;
      }

      if (!response.ok) {
        setError(data?.message || "No se pudo iniciar sesión");
        return;
      }

      const nextPath = searchParams.get("next") || "/";
      window.location.href = nextPath;
    } catch {
      setError("No se pudo iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-sm md:p-8 overflow-hidden">
      {/* Timer Overlay */}
      {countdown > 0 && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/90 p-8 text-center backdrop-blur-md transition-all duration-500 animate-in fade-in fill-mode-both">
          <div className="relative w-full max-w-[280px] overflow-hidden rounded-3xl bg-slate-900 px-6 py-10 shadow-2xl ring-1 ring-white/10">
            <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-500 ring-1 ring-red-500/20">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            
            <h3 className="mb-1 text-sm font-bold uppercase tracking-[0.2em] text-slate-400">Acceso Suspendido</h3>
            <p className="mb-6 text-[10px] text-slate-500 uppercase font-medium">Demasiados intentos fallidos</p>

            <div className="mb-8 font-mono text-6xl font-black tracking-tighter text-white tabular-nums">
              {formatTime(countdown)}
            </div>

            <div className="mx-auto w-full max-w-[180px]">
              <div className="mb-2 h-1.5 w-full rounded-full bg-slate-800 shadow-inner overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-600 to-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.5)] transition-all duration-1000 ease-linear"
                  style={{ width: `${(countdown / maxCountdown) * 100}%` }}
                />
              </div>
              <p className="text-[10px] font-medium text-slate-500 italic">Reintentá cuando termine el tiempo</p>
            </div>
          </div>
        </div>
      )}

      <h1 className="text-4xl font-bold text-gray-900">Ingresar</h1>
      <p className="mt-3 text-sm text-gray-600">Accedé al panel con tu email y contraseña.</p>

      <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-800">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-blue-500"
            autoComplete="email"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-800">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-blue-500"
            autoComplete="current-password"
          />
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? "Ingresando..." : "Ingresar"}
        </button>
      </form>
    </div>
  );
}
