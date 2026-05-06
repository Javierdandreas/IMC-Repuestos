import { listarSectores, listarUbicacionesPaginadas } from "@/modules/ubicaciones/repos/ubicaciones";
import { UbicacionesManager } from "@/modules/ubicaciones/components/UbicacionesManager";

export const metadata = {
  title: "Gestión de Ubicaciones",
};

export default async function UbicacionesPage() {
  const result = await listarUbicacionesPaginadas({ page: 1, pageSize: 25 });
  const sectores = await listarSectores();

  return (
    <div className="container mx-auto py-8">
      <UbicacionesManager initialData={result} sectores={sectores} />
    </div>
  );
}
