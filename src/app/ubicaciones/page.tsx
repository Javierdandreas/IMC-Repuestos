import { listarSectores, listarUbicaciones } from "@/modules/ubicaciones/repos/ubicaciones";
import { UbicacionesManager } from "@/modules/ubicaciones/components/UbicacionesManager";

export const metadata = {
  title: "Gestión de Ubicaciones",
};

export default async function UbicacionesPage() {
  const ubicaciones = await listarUbicaciones();
  const sectores = await listarSectores();

  return (
    <div className="container mx-auto py-8">
      <UbicacionesManager ubicaciones={ubicaciones} sectores={sectores} />
    </div>
  );
}
