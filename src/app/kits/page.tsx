import { getKitsListado } from "@/modules/kits/repos/kits";
import { KitList } from "@/components/kits/KitList";
import { getServerInternalUser } from "@/modules/auth";
import { canManageContent } from "@/modules/auth/repos/permissions";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function KitsPage({ searchParams }: Props) {
  const resolvedParams = await searchParams;
  const page = Number(resolvedParams?.page) || 1;
  const search = resolvedParams?.search as string;

  const [{ data: kits, totalPages, totalCount }, session] = await Promise.all([
    getKitsListado(page, 50, search),
    getServerInternalUser()
  ]);
  
  const canManage = canManageContent(session?.rol);

  return (
    <div className="bg-white dark:bg-black p-6 min-h-screen">
      <KitList
        kits={kits}
        totalPages={totalPages}
        totalCount={totalCount}
        currentPage={page}
        canManage={canManage}
      />
    </div>
  );
}
