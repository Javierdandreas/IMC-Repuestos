export type NotificationAudienceRole = "mostrador" | "deposito" | "administrador";

export type TipoNotificacion = 'confirmacion' | 'deposito' | 'deposito_parcial' | 'sistema';

export interface NotificacionSistema {
  id: string;
  userRole: NotificationAudienceRole;
  titulo: string;
  mensaje: string;
  tipo: TipoNotificacion;
  leida: boolean;
  createdAt: string;
  readAt?: string;
  presupuestoId?: string;
  codigoOP?: string;
}

