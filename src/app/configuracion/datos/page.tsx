import { CatalogTransfersPage } from "@/components/configuracion/CatalogTransfersPage";
import { getServerInternalUser } from "@/lib/auth";
import { canManageContent } from "@/lib/permissions";

export default async function ConfiguracionDatosPage() {
  const session = await getServerInternalUser();
  return <CatalogTransfersPage canManage={canManageContent(session?.rol)} />;
}
