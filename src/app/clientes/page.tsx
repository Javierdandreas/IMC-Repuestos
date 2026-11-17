import { ClientesPage } from "@/components/clientes/ClientesPage";
import { getMarcas, getTiposPrecio, getCategorias, getSubcategorias } from "@/lib/repos/catalogos";
import { getClientes } from "@/lib/repos/clientes";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function value(params: Record<string, string | string[] | undefined>, key: string) {
  const current = params[key];
  return typeof current === "string" ? current : undefined;
}

export default async function ClientesRoute({ searchParams }: Props) {
  const params = await searchParams;
  const [result, marcas, tiposPrecio, categorias, subcategorias] = await Promise.all([
    getClientes({
      page: Number(value(params, "page") ?? 1),
      limit: 25,
      search: value(params, "q"),
      tipoPersona: value(params, "tipoPersona"),
      condicionIva: value(params, "condicionIva"),
      idTipoPrecio: value(params, "idTipoPrecio"),
      bonificacion: value(params, "bonificacion"),
      descuentoMarca: value(params, "descuentoMarca"),
      estado: value(params, "estado") ?? "ACTIVO",
    }),
    getMarcas(),
    getTiposPrecio(),
    getCategorias(),
    getSubcategorias(),
  ]);

  return <ClientesPage clientes={result.data} totalPages={result.totalPages} totalCount={result.totalCount} marcas={marcas} tiposPrecio={tiposPrecio} categorias={categorias} subcategorias={subcategorias} />;
}
