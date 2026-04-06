import { MarcaList } from "@/components/marcas/MarcaList";
import { getMarcas } from "@/lib/repos/catalogos";

export default async function MarcasPage() {
  const marcas = await getMarcas();
  return <MarcaList marcas={marcas} />;
}
