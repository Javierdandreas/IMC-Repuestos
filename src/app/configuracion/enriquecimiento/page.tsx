import { EnriquecimientoPage } from "@/components/configuracion/EnriquecimientoPage";
import { getServerInternalUser } from "@/lib/auth";
import { canManageContent } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function ConfiguracionEnriquecimientoPage() {
  const session = await getServerInternalUser();
  return <EnriquecimientoPage canManage={canManageContent(session?.rol)} />;
}
