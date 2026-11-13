import { ProductList } from "@/components/products/ProductList";
import { getProductMeta } from "@/lib/productos-meta";
import { getItemsUnificadosListado } from "@/lib/repos/items-unificados";
import Link from "next/link";
import { getServerInternalUser } from "@/lib/auth";
import { canManageContent, puedeVerProductosInactivos } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function Home({ searchParams }: Props) {
  const resolvedParams = await searchParams;
  const page = Number(resolvedParams?.page) || 1;

  const session = await getServerInternalUser();
  const canManage = canManageContent(session?.rol);
  const canViewInactive = puedeVerProductosInactivos(session?.rol, session?.permisos);
  const requestedStatus = resolvedParams?.estado;
  const estado = canViewInactive && (requestedStatus === "INACTIVOS" || requestedStatus === "TODOS")
    ? requestedStatus
    : "ACTIVOS";
  const { data: products, totalPages, totalCount } = await getItemsUnificadosListado(page, 50, {
    search: resolvedParams?.search as string,
    searchSpecific: resolvedParams?.searchSpecific as string,
    categoria: resolvedParams?.categoria as string,
    subcategoria: resolvedParams?.subcategoria as string,
    marca: resolvedParams?.marca as string,
    proveedor: resolvedParams?.proveedor as string,
    estado,
    margenes: resolvedParams?.margenes as "COMPLETOS" | "FALTA_ALGUNO" | "FALTA_MOSTRADOR" | "FALTA_MECANICO" | "FALTA_MERCADO_LIBRE" | undefined,
    criterioCosto: resolvedParams?.criterioCosto as "PROVEEDOR_UNICO" | "MANUAL" | "MENOR_PRECIO" | "PROMEDIO_PRECIO" | "MAYOR_PRECIO" | undefined,
    mercadoLibre: resolvedParams?.mercadoLibre as "PUBLICADOS" | "SIN_PUBLICAR" | undefined,
  });

  return (
    <ProductList
      products={products}
      totalPages={totalPages}
      totalCount={totalCount}
      currentPage={page}
      canViewInactive={canViewInactive}
    />
  );
}
