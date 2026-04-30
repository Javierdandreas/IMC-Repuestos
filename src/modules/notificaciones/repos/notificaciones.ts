import { supabaseBrowser as supabase } from "@/utils/supabase/client";
import { normalizeRole } from "@/modules/auth/repos/permissions";
import type { AuthenticatedInternalUser } from "@/modules/auth/types/auth.types";
import type {
  NotificacionSistema,
  NotificationAudienceRole,
  TipoNotificacion,
} from "../types/notificaciones";

type NotificationTarget =
  | Pick<AuthenticatedInternalUser, "rol">
  | string
  | null
  | undefined;



export function mapRoleToNotificationAudience(
  target: NotificationTarget
): NotificationAudienceRole | null {
  const rawRole =
    typeof target === "string"
      ? target
      : target?.rol;

  if (!rawRole) return null;
  return normalizeRole(rawRole) as NotificationAudienceRole;
}

export function buildNotificationRealtimeFilter(
  target: NotificationTarget
) {
  const role = mapRoleToNotificationAudience(target);
  if (!role || role === "admin") {
    return undefined;
  }

  return `rol_destino=eq.${role}`;
}

export function getNotificationSoundFile(
  userRole: NotificationAudienceRole
) {
  return userRole === "vendedor"
    ? "/sounds/mostrador.wav"
    : "/sounds/deposito.wav";
}

/**
 * Obtener notificaciones desde Supabase para el rol actual.
 */
export async function obtenerNotificacionesSupabase(
  target: NotificationTarget
): Promise<NotificacionSistema[]> {
  const role = mapRoleToNotificationAudience(target);
  if (!role) {
    return [];
  }

  let query = supabase
    .from('notificaciones')
    .select('*');

  // Si no es admin, filtramos solo las de su sector o las generales de admin
  if (role !== 'admin') {
    query = query.or(`rol_destino.eq.${role},rol_destino.eq.admin`);
  }

  const { data, error } = await query
    .order('fecha', { ascending: false })
    .limit(50);

  if (error) {
    console.error("Error al obtener notificaciones de Supabase:", error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    userRole: row.rol_destino as NotificationAudienceRole,
    titulo: row.titulo,
    mensaje: row.mensaje,
    tipo: (row.tipo || 'sistema') as TipoNotificacion,
    leida: row.leida || false,
    createdAt: row.fecha,
    readAt: row.read_at || undefined,
    presupuestoId: row.presupuesto_id || undefined,
    codigoOP: row.codigo_op || undefined,
  }));
}

export async function crearNotificacionSupabase(payload: {
  userRole: NotificationAudienceRole;
  titulo: string;
  mensaje: string;
  tipo: TipoNotificacion;
  presupuestoId?: string;
  codigoOP?: string;
}) {
  const { error } = await supabase
    .from('notificaciones')
    .insert({
      rol_destino: payload.userRole,
      titulo: payload.titulo,
      mensaje: payload.mensaje,
      tipo: payload.tipo,
      fecha: new Date().toISOString(),
      leida: false,
      presupuesto_id: payload.presupuestoId ? (isNaN(Number(payload.presupuestoId)) ? payload.presupuestoId : Number(payload.presupuestoId)) : null,
      codigo_op: payload.codigoOP,
    });

  if (error) {
    console.error("Error al crear notificación en Supabase:", error);
    throw error;
  }
}

/**
 * Marcar una notificación como leída en Supabase.
 */
export async function marcarNotificacionLeidaSupabase(id: string) {
  const { error } = await supabase
    .from('notificaciones')
    .update({ 
      leida: true,
      read_at: new Date().toISOString()
    })
    .eq('id', id);

  if (error) {
    console.error("Error al marcar notificación como leída en Supabase:", error);
    throw error;
  }
}

/**
 * Marca todas las notificaciones de un presupuesto y tipo específico como leídas.
 * Útil para auto-limpiar la campana cuando se toma acción manual.
 */
export async function marcarNotificacionesPresupuestoLeidas(presupuestoId: string, tipo?: TipoNotificacion) {
  // Manejamos el ID como número o string según sea necesario
  const pId = isNaN(Number(presupuestoId)) ? presupuestoId : Number(presupuestoId);
  
  let query = supabase
    .from('notificaciones')
    .update({ 
      leida: true,
      read_at: new Date().toISOString()
    })
    .eq('presupuesto_id', pId)
    .eq('leida', false);

  if (tipo) {
    query = query.eq('tipo', tipo);
  }

  const { error } = await query;

  if (error) {
    console.error("Error al marcar notificaciones relacionadas como leídas:", error);
  }
}

/**
 * Borrar notificaciones antiguas leídas (mantenimiento sugerido)
 */
export async function limpiarNotificacionesAntiguasSupabase() {
  const diezMinutosAtras = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  
  const { error } = await supabase
    .from('notificaciones')
    .delete()
    .eq('leida', true)
    .lt('read_at', diezMinutosAtras);

  if (error) {
    console.error("Error al limpiar notificaciones antiguas:", error);
  }
}

