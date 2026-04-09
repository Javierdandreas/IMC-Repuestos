import { CatalogList } from "@/components/ui/CatalogList";
import { getPaginatedCatalogo } from "@/lib/repos/catalogos";

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function UbicacionesPage({ searchParams }: Props) {
  const resolvedParams = await searchParams;
  const page = Number(resolvedParams?.page) || 1;

  const { data: ubicaciones, totalPages } = await getPaginatedCatalogo("ubicaciones", page, 25);

  return (
    <CatalogList
      items={ubicaciones}
      totalPages={totalPages}
      apiPath="/api/ubicaciones"
      entityName="ubicación"
      title="Ubicaciones"
      createLabel="Nueva ubicación"
    />
  );
}
