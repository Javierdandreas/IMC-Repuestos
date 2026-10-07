import { getKitById } from "@/lib/repos/kits";
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
        <div className="min-h-[calc(100dvh-4rem)] bg-white dark:bg-black">
            <div className="w-full bg-white dark:bg-black">
                <KitForm kitId={id} initialData={kit} />
            </div>
        </div>
    );
}
