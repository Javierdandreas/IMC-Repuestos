import { ImportarCatalogoMaestroPage } from "@/components/listados/ImportarCatalogoMaestroPage";
import { getServerInternalUser } from "@/lib/auth";
import { puedeAccederPermisos } from "@/lib/permissions";
import { redirect } from "next/navigation";

type Props = { searchParams: Promise<{ tipo?: string }> };

export default async function ImportarCatalogoMaestroRoute({ searchParams }: Props) {
  const { tipo } = await searchParams;
  if (tipo !== "marcas" && tipo !== "categorias" && tipo !== "ubicaciones") redirect("/listados/base-de-datos");
  const session = await getServerInternalUser();
  return <ImportarCatalogoMaestroPage tipo={tipo} canImport={puedeAccederPermisos(session?.rol, session?.permisos, [`${tipo}:masivo`])} />;
}
