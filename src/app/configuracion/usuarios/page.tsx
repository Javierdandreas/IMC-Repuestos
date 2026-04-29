import { redirect } from "next/navigation";
import { getServerInternalUser } from "@/lib/auth";
import { tienePermiso } from "@/modules/auth/repos/permissions";
import { obtenerTodosLosUsuarios } from "@/modules/auth/repos/usuarios";
import { UsuariosPage } from "@/modules/auth/components/UsuariosPage";

export const dynamic = "force-dynamic";

export default async function GestionUsuariosRoute() {
  const user = await getServerInternalUser();

  // Verificación de acceso
  if (!user || !user.activo) {
    redirect("/login");
  }

  if (!tienePermiso(user, "usuarios.administrar")) {
    // Si no tiene permiso, redirigimos al dashboard o mostramos error.
    // Para simplificar, redirigimos al home.
    redirect("/");
  }

  const users = await obtenerTodosLosUsuarios();

  return <UsuariosPage initialUsers={users} />;
}
