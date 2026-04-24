"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { toast } from "sonner";

/**
 * Tiempo de inactividad permitido (1 hora por defecto)
 */
const TIMEOUT_MS = 60 * 60 * 2000; 

/**
 * Componente que monitorea la actividad del usuario y cierra la sesión
 * automáticamente tras un periodo de inactividad.
 */
export default function SessionTimeout() {
  const router = useRouter();
  const { user } = useUser();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const logout = useCallback(async () => {
    try {
      // Llamamos a la API de logout
      const response = await fetch("/api/auth/logout", { method: "POST" });
      
      if (response.ok) {
        toast.info("Sesión cerrada por inactividad", {
          description: "Por seguridad, hemos cerrado tu sesión debido a que estuviste mucho tiempo fuera.",
          duration: Infinity, // Se queda hasta que el usuario la cierre o se redirija
        });
        
        // Pequeña espera para que vea el toast (opcional)
        setTimeout(() => {
          window.location.href = "/login";
        }, 1000);
      }
    } catch (error) {
      console.error("Error al cerrar sesión por inactividad:", error);
      // Forzamos redirección si falla la API
      window.location.href = "/login";
    }
  }, []);

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    
    if (user) {
      timerRef.current = setTimeout(logout, TIMEOUT_MS);
    }
  }, [user, logout]);

  useEffect(() => {
    // Solo activamos si hay un usuario logueado
    if (!user) return;

    const events = [
      "mousedown",
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
      "click"
    ];

    // Iniciar el temporizador al montar
    resetTimer();

    // Agregar listeners para detectar actividad
    const handleActivity = () => resetTimer();
    
    events.forEach((event) => {
      window.addEventListener(event, handleActivity);
    });

    // Limpieza al desmontar
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [user, resetTimer]);

  return null; // El componente no renderiza nada visualmente
}
