"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, LoaderCircle } from "lucide-react";
import { toast } from "sonner";

type PushConfiguration = { configured: boolean; publicKey: string | null };
type PushState = "checking" | "inactive" | "active" | "unsupported" | "unavailable";

function applicationServerKey(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

export function PushNotificationsControl() {
  const [state, setState] = useState<PushState>("checking");
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [configuration, setConfiguration] = useState<PushConfiguration | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    const initialize = async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setState("unsupported");
        return;
      }
      try {
        const [response] = await Promise.all([
          fetch("/api/notificaciones/push", { cache: "no-store" }),
          navigator.serviceWorker.register("/sw.js", { scope: "/" }),
        ]);
        if (!response.ok) throw new Error();
        const nextConfiguration = await response.json() as PushConfiguration;
        const worker = await navigator.serviceWorker.ready;
        const nextSubscription = await worker.pushManager.getSubscription();
        setConfiguration(nextConfiguration);
        setRegistration(worker);
        setSubscription(nextSubscription);
        setState(nextSubscription ? "active" : nextConfiguration.configured ? "inactive" : "unavailable");
      } catch {
        setState("unsupported");
      }
    };
    void initialize();
  }, []);

  const activate = async () => {
    if (!registration || !configuration?.publicKey) {
      toast.error("Las notificaciones todavia no estan configuradas.");
      return;
    }
    try {
      setWorking(true);
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Tenes que permitir las notificaciones en el navegador.");
        return;
      }
      const nextSubscription = subscription || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey(configuration.publicKey),
      });
      const serialized = nextSubscription.toJSON();
      if (!serialized.keys?.p256dh || !serialized.keys.auth) throw new Error("La suscripcion no contiene las claves requeridas.");
      const response = await fetch("/api/notificaciones/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: nextSubscription.endpoint, keys: serialized.keys }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "No se pudo guardar la suscripcion.");
      setSubscription(nextSubscription);
      setState("active");
      toast.success("Alertas activadas en este dispositivo.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron activar las alertas.");
    } finally {
      setWorking(false);
    }
  };

  const deactivate = async () => {
    if (!subscription) return;
    try {
      setWorking(true);
      const response = await fetch("/api/notificaciones/push", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      if (!response.ok) throw new Error("No se pudo quitar la suscripcion.");
      await subscription.unsubscribe();
      setSubscription(null);
      setState("inactive");
      toast.success("Alertas desactivadas en este dispositivo.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron desactivar las alertas.");
    } finally {
      setWorking(false);
    }
  };

  if (state === "checking") return <span className="inline-flex h-9 w-9 items-center justify-center text-slate-400"><LoaderCircle className="h-4 w-4 animate-spin" /></span>;

  const unavailable = state === "unsupported" || state === "unavailable";
  const active = state === "active";
  return <button type="button" onClick={() => void (active ? deactivate() : activate())} disabled={working || unavailable} title={unavailable ? "Las alertas no estan disponibles en este navegador" : active ? "Desactivar alertas en este dispositivo" : "Activar alertas en este dispositivo"} className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${active ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300" : "border-slate-300 text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-blue-500/10 dark:hover:text-blue-300"}`}>{working ? <LoaderCircle className="h-4 w-4 animate-spin" /> : active ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}{active ? "Alertas activas" : "Activar alertas"}</button>;
}
