import { KitForm } from "@/components/kits/KitForm";
import { getKitById } from "@/lib/repos/kits";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function DuplicarKitPage({ params }: Props) {
  const { id } = await params;
  const kit = await getKitById(Number(id));

  if (!kit) notFound();

  return (
    <div className="min-h-screen bg-white p-6 dark:bg-black">
      <KitForm
        initialData={{
          ...kit,
          codigo_kit: "",
          nombre: `COPIA ${kit.nombre}`,
          imagen_url: null,
        }}
      />
    </div>
  );
}
