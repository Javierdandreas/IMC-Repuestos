"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, CheckCheck, LogOut, Volume2, VolumeX, ChevronRight } from "lucide-react";
// import { logout, useUsuarioPresupuestosActual } from "@/lib/presupuestos/auth-storage";
import { supabaseBrowser as supabase } from "@/utils/supabase/client";
import { useUser } from "@/context/UserContext";
import { usePermissions } from "@/modules/auth/components/usePermissions";
import {
  buildNotificationRealtimeFilter,
  getNotificationSoundFile,
  obtenerNotificacionesSupabase,
  marcarNotificacionLeidaSupabase,
  limpiarNotificacionesAntiguasSupabase,
  type NotificacionSistema
} from "@/modules/notificaciones";
import { motion, AnimatePresence } from "framer-motion";

type AppHeaderProps = {
  onToggleSidebar: () => void;
  onSelectSection?: (id: string) => void;
};

export function AppHeader({ onToggleSidebar, onSelectSection }: AppHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [openUser, setOpenUser] = useState(false);
  const [openNotif, setOpenNotif] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  const notifRef = useRef<HTMLDivElement | null>(null);
  const userRef = useRef<HTMLDivElement | null>(null);
  const prevNotifIdRef = useRef<string | null>(null);

  // Breadcrumbs logic
  const breadcrumbs = useMemo(() => {
    const paths = pathname.split("/").filter(Boolean);
    return paths.map((path, idx) => ({
      label: path.charAt(0).toUpperCase() + path.slice(1).replace("-", " "),
      href: "/" + paths.slice(0, idx + 1).join("/"),
      isLast: idx === paths.length - 1
    }));
  }, [pathname]);

  const handleCrumbClick = (label: string, isLast: boolean) => {
    if (isLast) return;

    const l = label.toLowerCase();
    if (l.includes("presupuestos") || l.includes("operaciones")) {
      onSelectSection?.("operaciones");
    } else if (l.includes("items") || l.includes("catalogo") || l.includes("repuestos")) {
      onSelectSection?.("catalogo");
    } else if (l.includes("config") || l.includes("sistema")) {
      onSelectSection?.("config");
    }
  };

  useEffect(() => {
    const muted = window.localStorage.getItem("imc_notif_muted");
    if (muted === "1") setIsMuted(true);
  }, []);

  const toggleMute = () => {
    const newValue = !isMuted;
    setIsMuted(newValue);
    window.localStorage.setItem("imc_notif_muted", newValue ? "1" : "0");
  };

  const [notificaciones, setNotificaciones] = useState<NotificacionSistema[]>([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const { user } = useUser();
  const { hasPermission } = usePermissions();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      window.location.href = "/login";
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      window.location.href = "/login";
    }
  };
  const puedeVerNotificaciones = hasPermission("notificaciones.ver");

  useEffect(() => {
    async function load() {
      if (!user?.rol || !puedeVerNotificaciones) {
        setNotificaciones([]);
        setNoLeidas(0);
        return;
      }

      const data = await obtenerNotificacionesSupabase(user.rol);
      setNotificaciones(data);
      setNoLeidas(data.filter(n => !n.leida).length);
    }
    load();
    limpiarNotificacionesAntiguasSupabase();
  }, [puedeVerNotificaciones, refreshKey, user?.rol]);

  useEffect(() => {
    if (!supabase || !user?.rol || !puedeVerNotificaciones) return;
    const filter = buildNotificationRealtimeFilter(user.rol);

    const channel = supabase
      .channel('notificaciones-realtime')
      .on(
        'postgres_changes',
        {
          event: '*', // Escuchamos INSERT, UPDATE (para el auto-marcar leído) y DELETE
          schema: 'public',
          table: 'notificaciones',
          ...(filter ? { filter } : {})
        },
        () => {
          setRefreshKey((prev) => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [puedeVerNotificaciones, user?.rol]);

  const playSound = useCallback((userRole: NotificacionSistema["userRole"]) => {
    const audioFile = getNotificationSoundFile(userRole);
    const audio = new Audio(audioFile);
    audio.volume = 0.7;
    audio.play().catch((err) => console.log("Error de audio:", err));
  }, []);

  useEffect(() => {
    if (notificaciones.length === 0) {
      prevNotifIdRef.current = null;
      return;
    }
    const latest = notificaciones[0];
    if (prevNotifIdRef.current === null) {
      const createdAt = new Date(latest.createdAt).getTime();
      const ahora = Date.now();
      const esMuyReciente = ahora - createdAt < 20000;
      if (!latest.leida && esMuyReciente && !isMuted) {
        playSound(latest.userRole);
      }
      prevNotifIdRef.current = latest.id;
      return;
    }
    if (prevNotifIdRef.current !== latest.id && !latest.leida) {
      if (!isMuted) playSound(latest.userRole);
      prevNotifIdRef.current = latest.id;
    }
  }, [notificaciones, isMuted, playSound]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (notifRef.current && !notifRef.current.contains(target)) setOpenNotif(false);
      if (userRef.current && !userRef.current.contains(target)) setOpenUser(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarcarLeida = async (id: string) => {
    try {
      await marcarNotificacionLeidaSupabase(id);
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      console.error("Error al marcar como leída:", error);
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return "";
    }
  };

  return (
    <header className="h-[72px] bg-white dark:bg-slate-950 border-b border-[#f1f1f2] dark:border-slate-900 flex items-center justify-between px-6 lg:px-10 shrink-0 select-none z-40">
      {/* Left: Breadcrumbs & Navigation Path */}
      <div className="flex items-center gap-4">
        <div className="flex items-center text-[13px] font-medium text-slate-400 dark:text-slate-500">
          {breadcrumbs.length === 0 ? (
            <span className="text-slate-900 dark:text-white font-bold">Dashboard</span>
          ) : (
            breadcrumbs.map((crumb, idx) => (
              <div key={idx} className="flex items-center">
                {idx > 0 && <ChevronRight className="h-4 w-4 mx-1.5 opacity-40" />}
                <span
                  onClick={() => handleCrumbClick(crumb.label, crumb.isLast)}
                  className={crumb.isLast
                    ? "text-slate-900 dark:text-white font-bold"
                    : "hover:text-slate-900 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  }
                >
                  {crumb.label}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-1.5 h-10 px-1.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-2xl">
          {/* Mute */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            type="button"
            onClick={toggleMute}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
            title={isMuted ? "Activar sonido" : "Silenciar"}
          >
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </motion.button>

          <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-700 mx-1" />

          {/* Notifications */}
          <div ref={notifRef} className="relative">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              type="button"
              onClick={() => setOpenNotif((prev) => !prev)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors relative"
            >
              <Bell className="h-4 w-4" />
              {noLeidas > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-[#e63946] rounded-full border-2 border-white dark:border-slate-950 shadow-sm animate-pulse" />
              )}
            </motion.button>

            <AnimatePresence>
              {openNotif && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className="absolute right-0 mt-3 w-[320px] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-2xl z-[60] overflow-hidden"
                >
                  <div className="px-5 py-4 border-b border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
                    <span className="text-[13px] font-bold text-slate-800 dark:text-slate-200">Notificaciones</span>
                    {noLeidas > 0 && (
                      <span className="text-[10px] bg-[#e63946] text-white px-2 py-0.5 rounded-full font-bold shadow-sm animate-pulse-subtle">
                        {noLeidas}
                      </span>
                    )}
                  </div>
                  <div className="max-h-[380px] overflow-y-auto py-1.5 bg-slate-50/30 dark:bg-slate-900/30">
                    {notificaciones.map((n) => {
                      const isPersonalizado = !n.leida;
                      let borderColor = "border-l-transparent";
                      let dotColor = "bg-slate-300 dark:bg-slate-600";

                      if (isPersonalizado) {
                        if (n.tipo === "confirmacion") {
                          borderColor = "border-l-[#e63946]";
                          dotColor = "bg-[#e63946]";
                        } else if (n.tipo === "deposito") {
                          borderColor = "border-l-[#10b981]";
                          dotColor = "bg-[#10b981]";
                        } else if (n.tipo === "deposito_parcial") {
                          borderColor = "border-l-[#f59e0b]";
                          dotColor = "bg-[#f59e0b]";
                        } else {
                          borderColor = "border-l-slate-900 dark:border-l-slate-200";
                          dotColor = "bg-slate-900 dark:bg-slate-200";
                        }
                      }

                      return (
                        <div key={n.id} className={`mx-2 mb-1.5 p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800 shadow-sm hover:shadow-md hover:border-slate-200 dark:hover:border-slate-700 transition-all ${borderColor} ${isPersonalizado ? 'border-l-4' : ''}`}>
                          <div className="flex justify-between items-start gap-2.5">
                            <div className="flex-1 min-w-0">
                              <p className="text-[11.5px] font-bold text-slate-900 dark:text-white truncate">{n.titulo}</p>
                              <p className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight line-clamp-2">{n.mensaje}</p>
                              <div className="flex items-center gap-1.5 mt-2">
                                <span className={`w-1 h-1 rounded-full ${dotColor}`} />
                                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">
                                  {formatTime(n.createdAt)} HS
                                </span>
                              </div>
                            </div>
                            {!n.leida && (
                              <button
                                onClick={() => handleMarcarLeida(n.id)}
                                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors shrink-0"
                                title="Marcar como leída"
                              >
                                <CheckCheck className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {notificaciones.length === 0 && <div className="p-10 text-center text-slate-400 dark:text-slate-500 text-[12px]">Sin notificaciones</div>}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* User */}
        <div ref={userRef} className="relative">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setOpenUser((prev) => !prev)}
            className="flex items-center gap-3 pl-1 pr-3 py-1 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-full shadow-sm hover:shadow-md transition-all h-10"
          >
            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-white dark:border-slate-700 shadow-sm flex items-center justify-center text-[10px] font-bold text-slate-500 overflow-hidden shrink-0">
              {user?.nombre?.substring(0, 2).toUpperCase() || 'AD'}
            </div>
            <div className="hidden md:block">
              <p className="text-[11px] font-bold leading-none text-slate-900 dark:text-white">{user?.nombre || 'Administrador'}</p>
              <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5 uppercase tracking-wider">{user?.rol || 'Staff'}</p>
            </div>
          </motion.button>

          <AnimatePresence>
            {openUser && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[24px] shadow-2xl z-[100] py-4"
              >
                <div className="px-5 pb-3 border-b border-slate-50 dark:border-slate-800 mb-2">
                  <p className="text-[14px] font-bold text-slate-900 dark:text-white">{user?.nombre} {user?.apellido}</p>
                  <p className="text-[12px] text-slate-400">@{user?.nombreUsuario || 'usuario'}</p>
                </div>
                
                <button 
                  onClick={() => { handleLogout(); setOpenUser(false); }}
                  className="w-full flex items-center gap-3 px-5 py-3 text-[13px] font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Cerrar Sesión
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
