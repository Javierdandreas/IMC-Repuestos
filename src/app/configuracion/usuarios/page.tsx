import { redirect } from "next/navigation";
import { getServerInternalUser } from "@/lib/auth";
import { UsuariosPage } from "@/components/configuracion/UsuariosPage";

export default async function Page() {
  const usuario = await getServerInternalUser();
  if (!usuario?.activo || usuario.rol !== "admin") redirect("/");
  return <UsuariosPage />;
}
