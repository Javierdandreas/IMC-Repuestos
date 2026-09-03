import { CatalogList } from "@/components/ui/CatalogList";
import { getPaginatedCatalogo } from "@/lib/repos/catalogos";

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function ProveedoresPage({ searchParams }: Props) {
  const resolvedParams = await searchParams;
  const page = Number(resolvedParams?.page) || 1;
  const search = typeof resolvedParams?.search === 'string' ? resolvedParams.search : undefined;

  const { data: proveedores, totalPages } = await getPaginatedCatalogo("proveedores", page, 25, search);

  return (
    <CatalogList
      items={proveedores}
      totalPages={totalPages}
      apiPath="/api/catalogos/proveedores"
      entityName="proveedor"
      title="Proveedores"
      createLabel="Nuevo proveedor"
      createPath="/proveedores/nuevo"
      editPathBase="/proveedores/editar"
      importPath="/proveedores/importar"
      exportPath="/proveedores/exportar"
    />
  );
}
