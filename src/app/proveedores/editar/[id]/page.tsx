import { notFound } from "next/navigation";

import { ProveedorEditPage } from "@/components/proveedores/ProveedorEditPage";
import { getProveedorById } from "@/lib/repos/catalogos";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditarProveedorPage({ params }: Props) {
  const { id } = await params;
  const proveedor = await getProveedorById(id);

  if (!proveedor) {
    notFound();
  }

  return <ProveedorEditPage proveedor={proveedor} />;
}
