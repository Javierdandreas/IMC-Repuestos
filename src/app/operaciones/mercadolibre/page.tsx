import { MercadoLibrePage } from "@/components/configuracion/MercadoLibrePage";
import { getServerInternalUser } from "@/lib/auth";
import { canManageContent, canReadContent, puedeAccederPermisos } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function OperacionesMercadoLibrePage() {
  const session = await getServerInternalUser();
  return <MercadoLibrePage
    canManage={canManageContent(session?.rol, session?.permisos)}
    canReply={canReadContent(session?.rol)}
    canViewCompatibilidades={puedeAccederPermisos(session?.rol, session?.permisos, ["ml_compatibilidades:leer"])}
  />;
}
