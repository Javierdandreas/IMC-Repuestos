"use client";

import { useState, useEffect } from "react";
import {
  UserRound,
  Plus,
  Search,
  MoreHorizontal,
  Mail,
  ShieldCheck,
  Check,
  X,
  Loader2,
  AlertTriangle
} from "lucide-react";
import { AuthenticatedInternalUser } from "../types/auth.types";
import { APP_ROLES } from "../types/usuarios";

type Props = {
  initialUsers: AuthenticatedInternalUser[];
};

export function UsuariosPage({ initialUsers }: Props) {
  const [users, setUsers] = useState<AuthenticatedInternalUser[]>(initialUsers);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filtrado de usuarios
  const filteredUsers = users.filter((u) => {
    const term = search.toLowerCase();
    return (
      u.nombre?.toLowerCase().includes(term) ||
      u.apellido?.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term) ||
      u.rol.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-black text-slate-900 tracking-tight flex items-center gap-3 dark:text-white">
            <UserRound className="h-8 w-8 text-slate-900 dark:text-blue-400" />
            Gestión de Personal
          </h1>
          <p className="text-slate-500 text-[14px] mt-1 dark:text-slate-400">
            Administrá los perfiles de tu equipo, asigná roles y controlá los accesos al sistema.
          </p>
        </div>
        <button
          disabled
          className="flex items-center gap-2 bg-slate-200 text-slate-500 px-5 py-2.5 rounded-2xl text-[14px] font-bold cursor-not-allowed opacity-60"
          title="El alta de usuarios se gestiona vía Supabase Auth"
        >
          <Plus className="h-4 w-4" />
          Nuevo Integrante
        </button>
      </header>

      {/* Main List */}
      <div className="bg-white border border-slate-100 rounded-[32px] overflow-hidden shadow-sm dark:bg-slate-900 dark:border-slate-800">
        <div className="p-6 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between dark:bg-slate-900/50 dark:border-slate-800">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, email o rol..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-100 rounded-xl text-[13px] outline-none focus:border-slate-300 transition-all shadow-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white dark:focus:border-blue-500"
            />
          </div>
          <div className="flex items-center gap-2 text-[12px] text-slate-400 font-medium bg-white px-3 py-1.5 rounded-lg border border-slate-100 shadow-sm dark:bg-slate-800 dark:border-slate-700">
            Total: <span className="text-slate-900 font-bold dark:text-white">{filteredUsers.length}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-50 dark:border-slate-800">
                <th className="px-8 py-5">Integrante</th>
                <th className="px-4 py-5">Email</th>
                <th className="px-4 py-5">Rol Canónico</th>
                <th className="px-4 py-5">Estado</th>
                <th className="px-8 py-5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {filteredUsers.map((user) => (
                <tr key={user.authUserId} className="group hover:bg-slate-50/50 transition-colors dark:hover:bg-slate-800/50">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-slate-100 border-2 border-white shadow-sm flex items-center justify-center text-[10px] font-bold text-slate-500 overflow-hidden shrink-0 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400">
                        {user.nombre?.substring(0, 1).toUpperCase()}{user.apellido?.substring(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-[14px] font-bold text-slate-900 dark:text-white">
                          {user.nombre} {user.apellido}
                        </p>
                        <p className="text-[12px] text-slate-400 font-medium dark:text-slate-500">
                          @{user.nombreUsuario || 'sin-usuario'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-5">
                    <div className="flex items-center gap-2 text-[12px] text-slate-500 dark:text-slate-400">
                      <Mail className="h-3 w-3" /> {user.email}
                    </div>
                  </td>
                  <td className="px-4 py-5">
                    <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 text-[11px] font-bold uppercase dark:bg-blue-900/20 dark:text-blue-400">
                      {APP_ROLES.find(r => r.id === user.rol)?.label || user.rol || 'Sin Rol'}
                    </span>
                  </td>
                  <td className="px-4 py-5">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${user.activo
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'
                      : 'bg-slate-50 text-slate-400 border-slate-100 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700'
                      }`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${user.activo ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                      {user.activo ? 'ACTIVO' : 'INACTIVO'}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button 
                      className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-all dark:hover:bg-slate-800 dark:hover:text-white"
                      title="Gestión avanzada próximamente"
                    >
                      <MoreHorizontal className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-8 py-10 text-center text-slate-400 text-[14px]">
                    No se encontraron usuarios que coincidan con la búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Box */}
      <div className="p-6 bg-blue-50 border border-blue-100 rounded-[28px] flex gap-4 dark:bg-blue-900/10 dark:border-blue-900/30">
        <div className="shrink-0 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm dark:bg-blue-900/20">
          <ShieldCheck className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h4 className="text-[14px] font-bold text-blue-900 dark:text-blue-400">Gestión de Accesos</h4>
          <p className="text-[13px] text-blue-700/80 mt-0.5 leading-relaxed dark:text-blue-500/80">
            Recordá que los permisos de cada rol están definidos en el repositorio central de políticas. 
            Para dar de alta nuevos usuarios o resetear contraseñas, utilizá el panel de Supabase Auth.
          </p>
        </div>
      </div>
    </div>
  );
}
