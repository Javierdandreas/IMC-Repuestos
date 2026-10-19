import { CatalogoCompatibilidadesPage } from "@/components/configuracion/CatalogoCompatibilidadesPage";
import { getServerInternalUser } from "@/lib/auth";
import { canManageContent } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function ConfiguracionCompatibilidadesPage() {
  const session = await getServerInternalUser();
  return <CatalogoCompatibilidadesPage canManage={canManageContent(session?.rol)} />;
}
