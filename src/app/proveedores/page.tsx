import { ProveedorList } from "@/components/proveedores/ProveedorList";
import { getProveedores } from "@/lib/repos/catalogos";

export default async function ProveedoresPage() {
  const proveedores = await getProveedores();
  return <ProveedorList proveedores={proveedores} />;
}
