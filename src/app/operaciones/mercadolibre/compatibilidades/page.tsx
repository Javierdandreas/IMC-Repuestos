import { CatalogoVehiculosMercadoLibrePage } from "@/components/configuracion/CatalogoVehiculosMercadoLibrePage";
import { MercadoLibreNavigation } from "@/components/mercadolibre/MercadoLibreNavigation";
import { getServerInternalUser } from "@/lib/auth";
import { canManageContent, puedeAccederPermisos } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function OperacionesMercadoLibreCompatibilidadesPage() {
  const session = await getServerInternalUser();
  const canViewCompatibilidades = puedeAccederPermisos(session?.rol, session?.permisos, ["ml_compatibilidades:leer"]);
  return <main className="min-h-[calc(100dvh-4rem)] bg-slate-50 dark:bg-slate-950"><MercadoLibreNavigation active="COMPATIBILIDADES" canViewCompatibilidades={canViewCompatibilidades} /><div className="p-4 md:p-6"><CatalogoVehiculosMercadoLibrePage canManage={canManageContent(session?.rol, session?.permisos)} /></div></main>;
}
