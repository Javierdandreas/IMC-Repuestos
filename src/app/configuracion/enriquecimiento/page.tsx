import { EnriquecimientoPage } from "@/components/configuracion/EnriquecimientoPage";
import { getServerInternalUser } from "@/lib/auth";
import { normalizeRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function ConfiguracionEnriquecimientoPage() {
  const session = await getServerInternalUser();
  const isAdmin = normalizeRole(session?.rol) === "admin";
  const permissions = new Set(session?.permisos || []);
  return <EnriquecimientoPage
    canManage={isAdmin || permissions.has("enriquecimiento:escribir")}
    canCreatePieza={isAdmin || permissions.has("piezas:escribir")}
  />;
}
