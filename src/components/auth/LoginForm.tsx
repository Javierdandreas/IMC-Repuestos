"use client";

import { useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginForm() {
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json().catch(() => ({}));
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
    <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
      <h1 className="text-4xl font-bold text-gray-900">Ingresar</h1>
      <p className="mt-3 text-sm text-gray-600">Accedé al panel con tu usuario administrador.</p>

      <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-800">Usuario</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-blue-500"
            autoComplete="username"
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
