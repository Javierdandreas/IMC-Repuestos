import { BaseDeDatosPage } from "@/components/listados/BaseDeDatosPage";
import { getServerInternalUser } from "@/lib/auth";
import { puedeAccederPermisos } from "@/lib/permissions";

export default async function ListadosBaseDeDatosPage() {
  const session = await getServerInternalUser();
  const can = (permiso: string) => puedeAccederPermisos(session?.rol, session?.permisos, [permiso]);
  return <BaseDeDatosPage acciones={{
    marcas: { leer: can("marcas:leer"), importar: can("marcas:masivo"), exportar: can("marcas:exportar") },
    categorias: { leer: can("categorias:leer"), importar: can("categorias:masivo"), exportar: can("categorias:exportar") },
    ubicaciones: { leer: can("ubicaciones:leer"), importar: can("ubicaciones:masivo"), exportar: can("ubicaciones:exportar") },
  }} />;
}
