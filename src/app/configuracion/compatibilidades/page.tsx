import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function ConfiguracionCompatibilidadesPage() {
  redirect("/operaciones/mercadolibre/compatibilidades");
}
