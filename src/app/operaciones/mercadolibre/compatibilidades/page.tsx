import { CatalogoVehiculosMercadoLibrePage } from "@/components/configuracion/CatalogoVehiculosMercadoLibrePage";
import { getServerInternalUser } from "@/lib/auth";
import { canManageContent } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function OperacionesMercadoLibreCompatibilidadesPage() {
  const session = await getServerInternalUser();
  return <CatalogoVehiculosMercadoLibrePage canManage={canManageContent(session?.rol, session?.permisos)} />;
}
