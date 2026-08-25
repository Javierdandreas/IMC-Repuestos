import { Activity, Barcode, Boxes, Clock3, MapPin, PackageSearch } from "lucide-react";
import { Pagination } from "@/components/ui/Pagination";
import { ImportSeriesInventoryButton } from "@/components/ubicaciones/ImportSeriesInventoryButton";
import { InventoryAutoFilters } from "@/components/ubicaciones/InventoryAutoFilters";
import { InventoryExportButton } from "@/components/ubicaciones/InventoryExportButton";
import { InventorySeriesQuickEdit } from "@/components/ubicaciones/InventorySeriesQuickEdit";
import { getUbicaciones } from "@/lib/repos/catalogos";
import { getInventarioUbicaciones } from "@/lib/repos/ubicaciones-inventario";
import { SERIE_ESTADO_LABELS } from "@/lib/serie-estados";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

function paramValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value ?? "";
}

function estadoClass(estado: string | null) {
  if (estado === "DISPONIBLE") return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
  if (estado === "MOSTRADOR") return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
  if (estado === "VENDIDO") return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300";
  if (estado === "BAJA") return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
  if (estado) return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
  return "bg-slate-50 text-slate-400 dark:bg-slate-900 dark:text-slate-500";
}

function estadoLabel(estado: string | null) {
  if (!estado) return "Stock";
  return SERIE_ESTADO_LABELS[estado as keyof typeof SERIE_ESTADO_LABELS] ?? estado;
}

function canalLabel(estado: string | null) {
  if (!estado) return "Stock";
  if (estado === "DISPONIBLE") return "Online + Mostrador";
  if (estado === "MOSTRADOR") return "Mostrador";
  return "No vendible";
}

function canalClass(estado: string | null) {
  if (!estado) return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
  if (estado === "DISPONIBLE") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
  if (estado === "MOSTRADOR") return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
  return "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function InventarioUbicacionesPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Number(paramValue(params.page)) || 1;
  const search = paramValue(params.search);
  const idUbicacion = paramValue(params.id_ubicacion);
  const estado = paramValue(params.estado);
  const tipo = paramValue(params.tipo) as "SERIE" | "STOCK" | "";
  const canal = paramValue(params.canal) as "ONLINE" | "MOSTRADOR" | "NO_VENDIBLE" | "";

  const [ubicaciones, inventario] = await Promise.all([
    getUbicaciones(),
    getInventarioUbicaciones(page, 50, {
      search,
      id_ubicacion: idUbicacion,
      estado,
      tipo,
      canal,
    }),
  ]);

  const exportParams = new URLSearchParams();
  if (search) exportParams.set("search", search);
  if (idUbicacion) exportParams.set("id_ubicacion", idUbicacion);
  if (estado) exportParams.set("estado", estado);
  if (tipo) exportParams.set("tipo", tipo);
  if (canal) exportParams.set("canal", canal);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
            <MapPin className="h-4 w-4" />
            Ubicaciones
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Inventario por ubicacion</h1>
          <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
            Consulta items, series, estados y cantidades desde una sola vista.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <ImportSeriesInventoryButton />
          <InventoryExportButton exportParams={exportParams.toString()} />
        </div>
      </div>

      <InventoryAutoFilters
        ubicaciones={ubicaciones}
        values={{
          search,
          idUbicacion,
          tipo,
          estado,
          canal,
        }}
      />

      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-3">
            <Boxes className="h-5 w-5 text-slate-400" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Unidades filtradas</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white">{inventario.totalCantidad}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-3">
            <Barcode className="h-5 w-5 text-slate-400" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Series filtradas</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white">{inventario.totalSeries}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-3">
            <PackageSearch className="h-5 w-5 text-slate-400" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Stock por ubicacion</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white">{inventario.totalStockRows}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-slate-400" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Filas filtradas</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white">{inventario.totalCount}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="w-full">
          <table className="w-full table-fixed text-left">
            <colgroup>
              <col className="w-[9%]" />
              <col className="w-[21%]" />
              <col className="w-[9%]" />
              <col className="w-[11%]" />
              <col className="w-[9%]" />
              <col className="w-[13%]" />
              <col className="w-[6%]" />
              <col className="w-[18%]" />
              <col className="w-[4%]" />
            </colgroup>
            <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:bg-slate-900/70">
              <tr>
                <th className="px-3 py-3">Ubicacion</th>
                <th className="px-3 py-3">Item</th>
                <th className="px-3 py-3">Codigo</th>
                <th className="px-3 py-3">Serie</th>
                <th className="px-3 py-3">Estado</th>
                <th className="px-3 py-3">Canal</th>
                <th className="px-3 py-3 text-right">Cant.</th>
                <th className="px-3 py-3">Ultimo movimiento</th>
                <th className="px-2 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {inventario.data.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-sm font-bold text-slate-400">
                    No hay resultados para los filtros aplicados.
                  </td>
                </tr>
              ) : (
                inventario.data.map((row, index) => (
                  <tr key={`${row.tipo}-${row.id_producto}-${row.id_serie ?? row.id_ubicacion ?? index}`} className="transition hover:bg-slate-50 dark:hover:bg-slate-900/50">
                    <td className="px-3 py-3">
                      <span className="inline-flex max-w-full truncate rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-black uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-200" title={row.ubicacion}>
                        {row.ubicacion}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="truncate text-sm font-bold text-slate-900 dark:text-white" title={row.producto}>{row.producto}</div>
                      <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {row.tipo === "SERIE" ? "Serializado" : "Stock"}
                      </div>
                    </td>
                    <td className="truncate px-3 py-3 font-mono text-xs font-black text-slate-600 dark:text-slate-300" title={row.cod_unico}>{row.cod_unico}</td>
                    <td className="break-all px-3 py-3 font-mono text-xs font-bold leading-4 text-slate-700 dark:text-slate-200">{row.numero_serie ?? "-"}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex max-w-full truncate rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${estadoClass(row.estado)}`} title={estadoLabel(row.estado)}>
                        {estadoLabel(row.estado)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex max-w-full truncate rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${canalClass(row.estado)}`} title={canalLabel(row.estado)}>
                        {canalLabel(row.estado)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right text-sm font-black text-slate-900 dark:text-white">{row.cantidad}</td>
                    <td className="px-3 py-3">
                      {row.ultimo_movimiento_tipo ? (
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-1.5 text-xs font-black uppercase text-slate-700 dark:text-slate-200">
                            <Clock3 className="h-3.5 w-3.5 text-slate-400" />
                            <span className="truncate">{row.ultimo_movimiento_tipo}</span>
                          </div>
                          <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            {formatDate(row.ultimo_movimiento_at)}
                          </div>
                          {row.ultimo_movimiento_observacion && (
                            <div className="mt-1 truncate text-xs font-medium text-slate-500 dark:text-slate-400" title={row.ultimo_movimiento_observacion}>
                              {row.ultimo_movimiento_observacion}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs font-bold text-slate-300">-</span>
                      )}
                    </td>
                    <td className="px-2 py-3 text-right">
                      <InventorySeriesQuickEdit row={row} ubicaciones={ubicaciones} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination totalPages={inventario.totalPages} />
    </div>
  );
}
