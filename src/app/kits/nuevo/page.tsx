import { KitForm } from "@/components/kits/KitForm";

export default function NuevoKitPage() {
    return (
        <div className="min-h-[calc(100dvh-4rem)] bg-white dark:bg-black">
            <div className="w-full bg-white dark:bg-black">
                <KitForm />
            </div>
        </div>
    );
}
