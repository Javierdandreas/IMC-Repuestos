import { ListadosHubPage } from "@/components/listados/ListadosHubPage";
import { getServerInternalUser } from "@/lib/auth";
import { puedeAccederPermisos } from "@/lib/permissions";

export default async function ListadosPage() {
  const session = await getServerInternalUser();
  const can = (permiso: string) => puedeAccederPermisos(session?.rol, session?.permisos, [permiso]);
  const disponibles = [
    can("movimientos_stock:leer") && "movimientos",
    can("productos:leer") && "items",
    can("inventario_ubicacion:leer") && "inventario",
    can("costos_modificados:leer") && "costos",
    can("marcas:leer") && "marcas",
    can("categorias:leer") && "categorias",
    can("ubicaciones:leer") && "ubicaciones",
  ].filter(Boolean) as string[];
  return <ListadosHubPage disponibles={disponibles} />;
}
