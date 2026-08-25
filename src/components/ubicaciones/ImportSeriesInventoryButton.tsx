import Link from "next/link";
import { Upload } from "lucide-react";

export function ImportSeriesInventoryButton() {
  return (
    <Link
      href="/ubicaciones/inventario/importar"
      className="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-500"
    >
      <Upload className="h-4 w-4" />
      Importar series
    </Link>
  );
}
