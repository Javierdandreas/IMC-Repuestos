import { CatalogList } from "@/components/ui/CatalogList";
import { getPaginatedCatalogo } from "@/lib/repos/catalogos";

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function ProveedoresPage({ searchParams }: Props) {
  const resolvedParams = await searchParams;
  const page = Number(resolvedParams?.page) || 1;

  const { data: proveedores, totalPages } = await getPaginatedCatalogo("proveedores", page, 25);

  return (
    <CatalogList
      items={proveedores}
      totalPages={totalPages}
      apiPath="/api/proveedores"
      entityName="proveedor"
      title="Proveedores"
      createLabel="Nuevo proveedor"
    />
  );
}
