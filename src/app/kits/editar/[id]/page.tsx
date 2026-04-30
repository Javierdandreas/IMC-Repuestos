import { getKitById } from "@/modules/kits/repos/kits";
import { KitForm } from "@/components/kits/KitForm";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = {
    params: Promise<{ id: string }>;
};

export default async function EditarKitPage({ params }: Props) {
    const { id } = await params;
    const kit = await getKitById(Number(id));

    if (!kit) {
        notFound();
    }

    return (
        <div className="bg-white dark:bg-black min-h-screen p-6">
            <KitForm kitId={id} initialData={kit} />
        </div>
    );
}
