"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, EyeOff, Plus, Save, UserRound } from "lucide-react";
import { CATALOGO_PERMISOS, type AccionPermiso } from "@/lib/catalogo-permisos";
import { Modal } from "@/components/ui/Modal";

type Usuario = { id: number; nombre: string; email: string | null; rol: string; activo: boolean };
type Permiso = { usuario_id: number; apartado: string; accion: string };

const labels: Record<AccionPermiso, string> = {
  leer: "Leer",
  escribir: "Escribir",
  eliminar: "Eliminar",
  exportar: "Exportar",
  masivo: "Masivo",
};

export function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [permisos, setPermisos] = useState<Permiso[]>([]);
  const [usuarioActualId, setUsuarioActualId] = useState<number | null>(null);
  const [seleccionado, setSeleccionado] = useState<number | null>(null);
  const [borrador, setBorrador] = useState<string[]>([]);
  const [nuevo, setNuevo] = useState(false);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState<"admin" | "empleado">("empleado");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [confirmarEstado, setConfirmarEstado] = useState<Usuario | null>(null);

  const cargar = useCallback(async () => {
    const response = await fetch("/api/usuarios", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "No se pudieron consultar los usuarios.");
    setUsuarios(data.usuarios);
    setPermisos(data.permisos);
    setUsuarioActualId(data.usuarioActualId);
    return data as { usuarios: Usuario[]; permisos: Permiso[]; usuarioActualId: number };
  }, []);

  useEffect(() => {
    cargar().catch((e) => setError(e.message)).finally(() => setCargando(false));
  }, [cargar]);

  const seleccionar = (usuario: Usuario) => {
    setSeleccionado(usuario.id);
    setNuevo(false);
    setEmail(usuario.email || "");
    setPassword("");
    setRol(usuario.rol.trim().toLowerCase() === "admin" ? "admin" : "empleado");
    setMostrarPassword(false);
    setMensaje("");
    setError("");
    setBorrador(permisos.filter((p) => p.usuario_id === usuario.id).map((p) => `${p.apartado}:${p.accion}`));
  };

  const actual = usuarios.find((u) => u.id === seleccionado);

  const cambiar = (apartado: string, accion: AccionPermiso, habilitado: boolean) => {
    setBorrador((prev) => {
      const next = new Set(prev);
      const key = `${apartado}:${accion}`;
      if (habilitado) {
        next.add(key);
        next.add(`${apartado}:leer`);
      } else if (accion === "leer") {
        for (const item of next) {
          if (item.startsWith(`${apartado}:`)) next.delete(item);
        }
      } else {
        next.delete(key);
      }
      return [...next];
    });
  };

  const cambiarGrupo = (grupo: string, habilitado: boolean) => {
    const keys = CATALOGO_PERMISOS
      .filter((permiso) => permiso.grupo === grupo)
      .flatMap((permiso) => permiso.acciones.map((accion) => `${permiso.id}:${accion}`));
    setBorrador((prev) => {
      const next = new Set(prev);
      if (habilitado) for (const key of keys) next.add(key);
      else for (const key of keys) next.delete(key);
      return [...next];
    });
  };

  const solicitar = async (method: string, body: unknown) => {
    setGuardando(true);
    setError("");
    setMensaje("");
    try {
      const response = await fetch("/api/usuarios", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No se pudo guardar.");
      await cargar();
      setMensaje("Cambios guardados.");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
      return false;
    } finally {
      setGuardando(false);
    }
  };

  const crear = async (event: React.FormEvent) => {
    event.preventDefault();
    if (await solicitar("POST", { nombre, email, password })) {
      setNombre("");
      setEmail("");
      setPassword("");
      setMostrarPassword(false);
      setNuevo(false);
    }
  };

  const guardarAcceso = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!actual) return;

    const emailNormalizado = email.trim().toLowerCase();
    const emailActual = (actual.email || "").trim().toLowerCase();
    const rolActual = actual.rol.trim().toLowerCase() === "admin" ? "admin" : "empleado";
    if (!password && emailNormalizado === emailActual && rol === rolActual) {
      setError("");
      setMensaje("No hay cambios para guardar.");
      return;
    }

    const body: { usuarioId: number; email?: string; password?: string; rol?: "admin" | "empleado" } = { usuarioId: actual.id };
    if (emailNormalizado !== emailActual) body.email = emailNormalizado;
    if (password) body.password = password;
    if (rol !== rolActual) body.rol = rol;
    if (await solicitar("PATCH", body)) {
      setPassword("");
      setMostrarPassword(false);
    }
  };

  const activar = async () => {
    if (!confirmarEstado || guardando) return;
    const ok = await solicitar("PATCH", {
      usuarioId: confirmarEstado.id,
      activo: !confirmarEstado.activo,
      confirmarLecturaGeneral: !confirmarEstado.activo,
    });
    if (ok) setConfirmarEstado(null);
  };

  const iniciarNuevo = () => {
    setNuevo(true);
    setSeleccionado(null);
    setNombre("");
    setEmail("");
    setPassword("");
    setMostrarPassword(false);
    setError("");
    setMensaje("");
  };

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4 text-sm text-slate-800 dark:text-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Usuarios</h1>
        <button type="button" onClick={iniciarNuevo} className="inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-xs font-bold text-white">
          <Plus className="h-4 w-4" />Nuevo usuario
        </button>
      </div>

      <p className="border-l-4 border-amber-500 bg-amber-500/10 p-3 text-amber-800 dark:text-amber-200">
        Los permisos individuales restringen paginas y APIs. Un empleado solo puede ingresar a los modulos que tengan permiso de lectura. Las cuentas nuevas se crean desactivadas.
      </p>
      {error && !confirmarEstado && <p role="alert" className="text-red-600 dark:text-red-300">{error}</p>}
      {mensaje && <p role="status" className="text-emerald-600">{mensaje}</p>}

      <div className="grid gap-5 md:grid-cols-[260px_minmax(0,1fr)]">
        <section className="divide-y divide-slate-200 border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
          <h2 className="p-3 text-xs font-bold">CUENTAS</h2>
          {cargando ? <p className="p-3">Cargando...</p> : usuarios.map((usuario) => (
            <button key={usuario.id} type="button" onClick={() => seleccionar(usuario)} className={`flex w-full items-start gap-2 p-3 text-left ${seleccionado === usuario.id ? "bg-blue-500/10" : "hover:bg-slate-500/5"}`}>
              <UserRound className="h-4 w-4 shrink-0" />
              <span className="min-w-0"><span className="block truncate font-bold">{usuario.nombre}</span><span className="block text-xs text-slate-500">{usuario.rol} | {usuario.activo ? "Activo" : "Inactivo"}</span></span>
            </button>
          ))}
        </section>

        <section className="min-w-0">
          {nuevo ? (
            <form onSubmit={(event) => void crear(event)} className="max-w-lg space-y-3">
              <h2 className="font-bold">Nuevo empleado</h2>
              <label className="block text-xs font-bold">Nombre<input required maxLength={100} value={nombre} onChange={(event) => setNombre(event.target.value)} className="mt-1 h-10 w-full rounded border border-slate-300 bg-transparent px-3 dark:border-slate-700" /></label>
              <label className="block text-xs font-bold">Correo<input required type="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 h-10 w-full rounded border border-slate-300 bg-transparent px-3 dark:border-slate-700" /></label>
              <label className="block text-xs font-bold">Contrasena inicial (minimo 12 caracteres)
                <span className="relative mt-1 block"><input required type={mostrarPassword ? "text" : "password"} minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-10 w-full rounded border border-slate-300 bg-transparent px-3 pr-10 dark:border-slate-700" /><button type="button" onClick={() => setMostrarPassword((actualmenteVisible) => !actualmenteVisible)} className="absolute inset-y-0 right-0 px-3 text-slate-500" aria-label={mostrarPassword ? "Ocultar contrasena" : "Mostrar contrasena"}>{mostrarPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></span>
              </label>
              <button disabled={guardando} className="rounded bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Crear cuenta inactiva</button>
            </form>
          ) : actual ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h2 className="font-bold">{actual.nombre}</h2><p className="text-xs text-slate-500">{actual.email || "Sin correo"} | {actual.rol} | {actual.activo ? "Activo" : "Inactivo"}</p></div>
                {actual.rol.toLowerCase() === "empleado" && <button type="button" disabled={guardando} onClick={() => { setError(""); setConfirmarEstado(actual); }} className="rounded border border-slate-400 px-3 py-2 text-xs font-bold">{actual.activo ? "Desactivar" : "Activar"}</button>}
              </div>

              {actual.id !== usuarioActualId ? <form onSubmit={(event) => void guardarAcceso(event)} className="max-w-lg space-y-3 border-b border-slate-200 pb-4 dark:border-slate-700">
                <h3 className="font-bold">Acceso y rol</h3>
                <label className="block text-xs font-bold">Rol<select value={rol} onChange={(event) => setRol(event.target.value as "admin" | "empleado")} className="mt-1 h-10 w-full rounded border border-slate-300 bg-transparent px-3 dark:border-slate-700"><option value="empleado">Empleado</option><option value="admin">Administrador</option></select></label>
                <label className="block text-xs font-bold">Correo<input required type="email" maxLength={254} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 h-10 w-full rounded border border-slate-300 bg-transparent px-3 dark:border-slate-700" /></label>
                <label className="block text-xs font-bold">Nueva contrasena (minimo 12 caracteres)
                  <span className="relative mt-1 block"><input type={mostrarPassword ? "text" : "password"} minLength={12} maxLength={128} autoComplete="new-password" placeholder="Dejar vacio para conservar la actual" value={password} onChange={(event) => setPassword(event.target.value)} className="h-10 w-full rounded border border-slate-300 bg-transparent px-3 pr-10 dark:border-slate-700" /><button type="button" onClick={() => setMostrarPassword((actualmenteVisible) => !actualmenteVisible)} className="absolute inset-y-0 right-0 px-3 text-slate-500" aria-label={mostrarPassword ? "Ocultar contrasena" : "Mostrar contrasena"}>{mostrarPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></span>
                </label>
                <p className="text-xs text-slate-500">Por seguridad, una contrasena ya guardada no puede recuperarse ni mostrarse.</p>
                <button disabled={guardando} className="inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><Save className="h-4 w-4" />Guardar acceso y rol</button>
              </form> : <p className="text-xs text-slate-500">No puedes modificar tu propia cuenta desde esta pantalla.</p>}

              {actual.rol.toLowerCase() === "empleado" ? <>
                <h3 className="font-bold">Permisos propuestos</h3>
                <div className="space-y-4">
                  {Array.from(new Set(CATALOGO_PERMISOS.map((permiso) => permiso.grupo))).map((grupo) => {
                    const permisosGrupo = CATALOGO_PERMISOS.filter((permiso) => permiso.grupo === grupo);
                    const keysGrupo = permisosGrupo.flatMap((permiso) => permiso.acciones.map((accion) => `${permiso.id}:${accion}`));
                    const grupoCompleto = keysGrupo.every((key) => borrador.includes(key));
                    return <div key={grupo}>
                      <div className="flex items-center justify-between gap-3 border-b border-slate-300 py-2 dark:border-slate-700"><h4 className="text-xs font-bold">{grupo}</h4><label className="flex items-center gap-1 text-xs font-bold"><input type="checkbox" checked={grupoCompleto} onChange={(event) => cambiarGrupo(grupo, event.target.checked)} disabled={guardando} />Todo</label></div>
                      {permisosGrupo.map((permiso) => <div key={permiso.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 py-2 dark:border-slate-800"><span className="font-semibold">{permiso.nombre}</span><div className="flex flex-wrap gap-3">{permiso.acciones.map((accion) => <label key={accion} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={borrador.includes(`${permiso.id}:${accion}`)} onChange={(event) => cambiar(permiso.id, accion, event.target.checked)} disabled={guardando} />{labels[accion]}</label>)}</div></div>)}
                    </div>;
                  })}
                </div>
                <button type="button" disabled={guardando} onClick={() => void solicitar("PATCH", { usuarioId: actual.id, permisos: borrador.map((key) => { const [apartado, accion] = key.split(":"); return { apartado, accion }; }) })} className="inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><Save className="h-4 w-4" />Guardar propuesta</button>
              </> : <p className="text-xs text-slate-500">Los administradores conservan el acceso completo.</p>}
            </div>
          ) : <p className="text-slate-500">Selecciona una cuenta.</p>}
        </section>
      </div>

      {confirmarEstado && <Modal title={confirmarEstado.activo ? "Desactivar usuario" : "Activar usuario"} open onClose={() => { if (!guardando) { setConfirmarEstado(null); setError(""); } }} width="w-[min(96vw,480px)]"><div className="space-y-4 p-6"><p>{confirmarEstado.activo ? "El usuario no podra ingresar al sistema mientras su cuenta este desactivada." : "El usuario podra ingresar al sistema si tiene al menos un permiso de lectura."}</p><p className="break-words font-bold">{confirmarEstado.nombre}</p>{!confirmarEstado.activo && <p className="border-l-4 border-amber-500 bg-amber-500/10 p-3 text-amber-800 dark:text-amber-200">Antes de activarlo, asigna por lo menos un permiso de lectura y guarda la propuesta.</p>}{error && <p role="alert" className="text-red-600 dark:text-red-300">{error}</p>}<div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={guardando} onClick={() => { setConfirmarEstado(null); setError(""); }} className="rounded border border-slate-400 px-4 py-2 text-xs font-bold disabled:opacity-50">Cancelar</button><button type="button" disabled={guardando} onClick={() => void activar()} className={`rounded px-4 py-2 text-xs font-bold text-white disabled:opacity-50 ${confirmarEstado.activo ? "bg-red-600" : "bg-blue-600"}`}>{guardando ? "Guardando..." : confirmarEstado.activo ? "Desactivar usuario" : "Activar usuario"}</button></div></div></Modal>}
    </main>
  );
}
