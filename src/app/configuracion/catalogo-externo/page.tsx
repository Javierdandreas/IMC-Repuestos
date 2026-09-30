import { ExternalCatalogPage } from "@/components/configuracion/ExternalCatalogPage";
import { getServerInternalUser } from "@/lib/auth";
import { canManageContent } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function CatalogoExternoPage() {
  const session = await getServerInternalUser();
  return <ExternalCatalogPage canManage={canManageContent(session?.rol)} />;
}
