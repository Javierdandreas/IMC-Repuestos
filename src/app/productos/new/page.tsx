import { ProductForm } from "@/components/products/ProductForm";
import { getProductMeta } from "@/lib/productos-meta";

interface Props {
  searchParams?: Promise<{ piezaCodigo?: string | string[] }>;
}

export default async function NewProductPage({ searchParams }: Props) {
  const meta = await getProductMeta();
  const resolvedSearchParams = (await searchParams) ?? {};
  const piezaCodigoRaw = Array.isArray(resolvedSearchParams.piezaCodigo)
    ? resolvedSearchParams.piezaCodigo[0]
    : resolvedSearchParams.piezaCodigo;

  const piezaCodigo = (piezaCodigoRaw ?? "").toString().trim().toUpperCase();
  const piezaSeleccionada = piezaCodigo
    ? meta.piezas.find((pieza) => pieza.codigo_pieza === piezaCodigo) ?? null
    : null;

  const initialProduct = piezaSeleccionada
    ? {
        cod_unico: "",
        descripcion: piezaSeleccionada.descripcion,
        cod_barra: "",
        stock: 0,
        id_pieza: piezaSeleccionada.id,
        id_categoria: piezaSeleccionada.id_categoria,
        id_subcategoria: piezaSeleccionada.id_subcategoria,
        id_marca: null,
        proveedores: [{ id_proveedor: null, codigo_proveedor: "" }],
        pieza: piezaSeleccionada,
        originales: piezaSeleccionada.originales ?? [],
        equivalentes: piezaSeleccionada.equivalentes ?? [],
      }
    : undefined;

  return <ProductForm meta={meta} initialProduct={initialProduct} />;
}
