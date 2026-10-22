"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Save, UserRound } from "lucide-react";
import { CATALOGO_PERMISOS, type AccionPermiso } from "@/lib/catalogo-permisos";

type Usuario = { id: number; nombre: string; email: string | null; rol: string; activo: boolean };
type Permiso = { usuario_id: number; apartado: string; accion: string };
const labels: Record<AccionPermiso, string> = { leer: "Leer", escribir: "Escribir", eliminar: "Eliminar", exportar: "Exportar", masivo: "Masivo" };

export function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [permisos, setPermisos] = useState<Permiso[]>([]);
  const [seleccionado, setSeleccionado] = useState<number | null>(null);
  const [borrador, setBorrador] = useState<string[]>([]);
  const [nuevo, setNuevo] = useState(false);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    const response = await fetch("/api/usuarios", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "No se pudieron consultar los usuarios.");
    setUsuarios(data.usuarios); setPermisos(data.permisos);
    return data as { usuarios: Usuario[]; permisos: Permiso[] };
  }, []);
  useEffect(() => { cargar().catch((e) => setError(e.message)).finally(() => setCargando(false)); }, [cargar]);

  const seleccionar = (usuario: Usuario) => {
    setSeleccionado(usuario.id); setNuevo(false); setPassword(""); setMensaje(""); setError("");
    setBorrador(permisos.filter((p) => p.usuario_id === usuario.id).map((p) => `${p.apartado}:${p.accion}`));
  };
  const actual = usuarios.find((u) => u.id === seleccionado);
  const cambiar = (apartado: string, accion: AccionPermiso, habilitado: boolean) => {
    setBorrador((prev) => {
      const next = new Set(prev); const key = `${apartado}:${accion}`;
      if (habilitado) { next.add(key); next.add(`${apartado}:leer`); }
      else if (accion === "leer") for (const item of next) { if (item.startsWith(`${apartado}:`)) next.delete(item); }
      else next.delete(key);
      return [...next];
    });
  };
  const solicitar = async (method: string, body: unknown) => {
    setGuardando(true); setError(""); setMensaje("");
    try {
      const response = await fetch("/api/usuarios", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No se pudo guardar.");
      await cargar(); setMensaje("Cambios guardados."); return true;
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar."); return false; }
    finally { setGuardando(false); }
  };
  const crear = async (event: React.FormEvent) => {
    event.preventDefault();
    if (await solicitar("POST", { nombre, email, password })) { setNombre(""); setEmail(""); setPassword(""); setNuevo(false); }
  };
  const activar = async () => {
    if (!actual) return;
    const texto = actual.activo ? `Desactivar a ${actual.nombre}?` : `Activar a ${actual.nombre}? Tendra acceso de lectura general: los permisos individuales aun no se aplican.`;
    if (!window.confirm(texto)) return;
    await solicitar("PATCH", { usuarioId: actual.id, activo: !actual.activo, confirmarLecturaGeneral: !actual.activo });
  };

  return <main className="mx-auto max-w-7xl space-y-4 p-4 text-sm text-slate-800 dark:text-slate-200">
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-xl font-bold">Usuarios</h1><button type="button" onClick={() => { setNuevo(true); setSeleccionado(null); setError(""); setMensaje(""); }} className="inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-xs font-bold text-white"><Plus className="h-4 w-4" />Nuevo usuario</button></div>
    <p className="border-l-4 border-amber-500 bg-amber-500/10 p-3 text-amber-800 dark:text-amber-200">Los permisos individuales son borradores y todavia no restringen el acceso. Un empleado activo puede consultar la informacion general. Las cuentas nuevas se crean desactivadas.</p>
    {error && <p role="alert" className="text-red-600 dark:text-red-300">{error}</p>}{mensaje && <p role="status" className="text-emerald-600">{mensaje}</p>}
    <div className="grid gap-5 md:grid-cols-[260px_minmax(0,1fr)]"><section className="divide-y divide-slate-200 border border-slate-200 dark:divide-slate-700 dark:border-slate-700"><h2 className="p-3 text-xs font-bold">CUENTAS</h2>{cargando ? <p className="p-3">Cargando...</p> : usuarios.map((u) => <button key={u.id} type="button" onClick={() => seleccionar(u)} className={`flex w-full items-start gap-2 p-3 text-left ${seleccionado === u.id ? "bg-blue-500/10" : "hover:bg-slate-500/5"}`}><UserRound className="h-4 w-4 shrink-0" /><span className="min-w-0"><span className="block truncate font-bold">{u.nombre}</span><span className="block text-xs text-slate-500">{u.rol} | {u.activo ? "Activo" : "Inactivo"}</span></span></button>)}</section>
    <section className="min-w-0">{nuevo ? <form onSubmit={(event) => void crear(event)} className="max-w-lg space-y-3"><h2 className="font-bold">Nuevo empleado</h2><label className="block text-xs font-bold">Nombre<input required maxLength={100} value={nombre} onChange={(e) => setNombre(e.target.value)} className="mt-1 h-10 w-full rounded border border-slate-300 bg-transparent px-3 dark:border-slate-700" /></label><label className="block text-xs font-bold">Correo<input required type="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 h-10 w-full rounded border border-slate-300 bg-transparent px-3 dark:border-slate-700" /></label><label className="block text-xs font-bold">Contrasena inicial (minimo 12 caracteres)<input required type="password" minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 h-10 w-full rounded border border-slate-300 bg-transparent px-3 dark:border-slate-700" /></label><button disabled={guardando} className="rounded bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Crear cuenta inactiva</button></form> : actual ? <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold">{actual.nombre}</h2><p className="text-xs text-slate-500">{actual.email || "Sin correo"} | {actual.rol} | {actual.activo ? "Activo" : "Inactivo"}</p></div>{actual.rol.toLowerCase() === "empleado" && <button type="button" disabled={guardando} onClick={() => void activar()} className="rounded border border-slate-400 px-3 py-2 text-xs font-bold">{actual.activo ? "Desactivar" : "Activar"}</button>}</div>
    {actual.rol.toLowerCase() === "empleado" ? <><h3 className="font-bold">Permisos propuestos</h3><div className="space-y-4">{Array.from(new Set(CATALOGO_PERMISOS.map((p) => p.grupo))).map((grupo) => <div key={grupo}><h4 className="border-b border-slate-300 py-2 text-xs font-bold dark:border-slate-700">{grupo}</h4>{CATALOGO_PERMISOS.filter((p) => p.grupo === grupo).map((p) => <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 py-2 dark:border-slate-800"><span className="font-semibold">{p.nombre}</span><div className="flex flex-wrap gap-3">{p.acciones.map((accion) => <label key={accion} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={borrador.includes(`${p.id}:${accion}`)} onChange={(e) => cambiar(p.id, accion, e.target.checked)} disabled={guardando} />{labels[accion]}</label>)}</div></div>)}</div>)}</div><button type="button" disabled={guardando} onClick={() => void solicitar("PATCH", { usuarioId: actual.id, permisos: borrador.map((key) => { const [apartado, accion] = key.split(":"); return { apartado, accion }; }) })} className="inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><Save className="h-4 w-4" />Guardar propuesta</button></> : <p className="text-xs text-slate-500">Los administradores conservan el acceso completo.</p>}</div> : <p className="text-slate-500">Selecciona una cuenta.</p>}</section></div>
  </main>;
}
