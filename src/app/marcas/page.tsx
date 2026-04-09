import { CatalogList } from "@/components/ui/CatalogList";
import { getPaginatedCatalogo } from "@/lib/repos/catalogos";

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function MarcasPage({ searchParams }: Props) {
  const resolvedParams = await searchParams;
  const page = Number(resolvedParams?.page) || 1;

  const { data: marcas, totalPages } = await getPaginatedCatalogo("marcas", page, 25);

  return (
    <CatalogList
      items={marcas}
      totalPages={totalPages}
      apiPath="/api/catalogos/marcas"
      entityName="marca"
      title="Marcas"
      createLabel="Nueva marca"
    />
  );
}
