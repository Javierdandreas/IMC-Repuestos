"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { ArrowLeft, PackagePlus, Plus, Save, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useMetadata } from "@/context/MetadataContext";
import { useAppError } from "@/context/AppErrorContext";
import type { ProductoListado } from "@/interfaces/productos";

type ProductoSearchResponse = {
  data: ProductoListado[];
};

type CompraLinea = {
  producto: ProductoListado;
  cantidad: number;
  costoUnitario: number;
  descuento: number;
  iva: number;
  idUbicacion: number | null;
  codigoProveedor: string;
  seriesTexto: string;
};

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error("No se pudieron buscar los items");
  return response.json();
};

const normalizar = (value: string) => value.trim().toUpperCase();

const parseSeries = (value: string) =>
  value
    .split(/[\n,;]+/)
    .map((serie) => normalizar(serie))
    .filter(Boolean);

const formatMoney = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

export function NuevaCompraPage() {
  const router = useRouter();
  const { proveedores, ubicaciones } = useMetadata();
  const { showError, showMessage } = useAppError();
  const [idProveedor, setIdProveedor] = useState("");
  const [fechaOperacion, setFechaOperacion] = useState(() => new Date().toISOString().slice(0, 10));
  const [tipoComprobante, setTipoComprobante] = useState("SIN COMPROBANTE");
  const [numeroComprobante, setNumeroComprobante] = useState("");
  const [observacion, setObservacion] = useState("");
  const [actualizaCostoProveedor, setActualizaCostoProveedor] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [lineas, setLineas] = useState<CompraLinea[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const searchKey = busqueda.trim().length >= 2
    ? `/api/productos?search=${encodeURIComponent(busqueda.trim())}&limit=8`
    : null;
  const { data: searchResult, isLoading: isSearching } = useSWR<ProductoSearchResponse>(searchKey, fetcher);
  const resultados = searchResult?.data ?? [];
  const proveedorSeleccionado = proveedores.find((proveedor) => String(proveedor.id) === idProveedor) ?? null;
  const sinUbicacionId = ubicaciones.find((ubicacion) => normalizar(ubicacion.descripcion) === "SIN UBICACION")?.id ?? null;

  const resumen = useMemo(() => {
    const neto = lineas.reduce((total, linea) => {
      const costoConDescuento = linea.costoUnitario * (1 - linea.descuento / 100);
      return total + linea.cantidad * costoConDescuento;
    }, 0);
    const iva = lineas.reduce((total, linea) => {
      const costoConDescuento = linea.costoUnitario * (1 - linea.descuento / 100);
      return total + linea.cantidad * costoConDescuento * (linea.iva / 100);
    }, 0);
    return { neto, iva, total: neto + iva };
  }, [lineas]);

  const agregarProducto = (producto: ProductoListado) => {
    if (!proveedorSeleccionado) {
      showMessage("Selecciona primero el proveedor de la compra.");
      return;
    }
    if (lineas.some((linea) => linea.producto.id === producto.id)) {
      showMessage("Ese item ya esta agregado a la compra.");
      return;
    }

    const datosProveedor = producto.proveedores_detalle?.find(
      (item) => normalizar(item.proveedor) === normalizar(proveedorSeleccionado.descripcion)
    );
    const costoGuardado = Number(datosProveedor?.costo_actual ?? datosProveedor?.precio_lista_actual ?? 0);

    setLineas((actuales) => [
      ...actuales,
      {
        producto,
        cantidad: 1,
        costoUnitario: Number.isFinite(costoGuardado) ? costoGuardado : 0,
        descuento: 0,
        iva: 0,
        idUbicacion: sinUbicacionId ?? producto.id_ubicacion ?? null,
        codigoProveedor: datosProveedor?.codigo_proveedor ?? "",
        seriesTexto: "",
      },
    ]);
    setBusqueda("");
  };

  const actualizarLinea = <K extends keyof CompraLinea>(index: number, key: K, value: CompraLinea[K]) => {
    setLineas((actuales) => actuales.map((linea, lineaIndex) => (
      lineaIndex === index ? { ...linea, [key]: value } : linea
    )));
  };

  const cambiarProveedor = (nextProveedorId: string) => {
    if (nextProveedorId !== idProveedor && lineas.length > 0) {
      setLineas([]);
      toast.info("Se quitaron los items para cargar los datos del nuevo proveedor.");
    }
    setIdProveedor(nextProveedorId);
  };

  const buscarCodigoEscaneado = async () => {
    const codigo = busqueda.trim();
    if (!codigo) return;

    try {
      const response = await fetch(`/api/productos?searchSpecific=${encodeURIComponent(codigo)}&limit=5`);
      const data = await response.json() as ProductoSearchResponse;
      if (!response.ok) throw new Error("No se pudo buscar el item");
      if (data.data.length === 1) {
        agregarProducto(data.data[0]);
        return;
      }
      if (data.data.length === 0) showMessage("No se encontro un item con ese codigo o codigo de barras.");
    } catch (error) {
      showError(error, "No se pudo leer el codigo escaneado");
    }
  };

  const guardarCompra = async () => {
    if (!idProveedor) {
      showMessage("Selecciona un proveedor.");
      return;
    }
    if (lineas.length === 0) {
      showMessage("Agrega al menos un item a la compra.");
      return;
    }

    const seriesUsadas = new Set<string>();
    for (const linea of lineas) {
      if (!Number.isInteger(linea.cantidad) || linea.cantidad <= 0) {
        showMessage(`La cantidad de ${linea.producto.cod_unico} debe ser un numero entero mayor a cero.`);
        return;
      }
      if (!linea.idUbicacion) {
        showMessage(`Selecciona una ubicacion para ${linea.producto.cod_unico}.`);
        return;
      }
      if (linea.producto.usa_numero_serie) {
        const series = parseSeries(linea.seriesTexto);
        if (series.length !== linea.cantidad) {
          showMessage(`${linea.producto.cod_unico} requiere ${linea.cantidad} numero(s) de serie.`);
          return;
        }
        if (new Set(series).size !== series.length || series.some((serie) => seriesUsadas.has(serie))) {
          showMessage("No se puede repetir un numero de serie dentro de la compra.");
          return;
        }
        series.forEach((serie) => seriesUsadas.add(serie));
      }
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/operaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "COMPRA",
          id_proveedor: Number(idProveedor),
          fecha_operacion: fechaOperacion,
          tipo_comprobante: tipoComprobante === "SIN COMPROBANTE" ? null : tipoComprobante,
          numero_comprobante: numeroComprobante.trim() || null,
          moneda: "ARS",
          actualiza_costo_proveedor: actualizaCostoProveedor,
          observacion: observacion.trim() || null,
          detalles: lineas.map((linea) => ({
            id_producto: linea.producto.id,
            cantidad: linea.cantidad,
            precio_unitario: linea.costoUnitario,
            descuento_porcentaje: linea.descuento,
            iva_porcentaje: linea.iva,
            codigo_proveedor: linea.codigoProveedor.trim() || null,
            id_ubicacion: linea.idUbicacion,
            numeros_serie: linea.producto.usa_numero_serie ? parseSeries(linea.seriesTexto) : [],
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No se pudo registrar la compra");

      toast.success("Compra confirmada y stock actualizado.");
      router.push("/operaciones?tipo=COMPRA");
      router.refresh();
    } catch (error) {
      showError(error, "No se pudo confirmar la compra");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mb-5 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => router.push("/operaciones?tipo=COMPRA")}
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 transition hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a compras
        </button>
        <button
          type="button"
          onClick={guardarCompra}
          disabled={isSaving || lineas.length === 0}
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-5 text-xs font-black uppercase tracking-widest text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> {isSaving ? "Confirmando..." : "Confirmar compra"}
        </button>
      </div>

      <section className="border-b border-slate-200 pb-5 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
            <PackagePlus className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">Nueva compra</h1>
            <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">Ingresa mercaderia, costos y series en una sola operacion.</p>
          </div>
        </div>
      </section>

      <section className="mt-5 border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="mb-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Datos de compra</div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(260px,1.5fr)_170px_180px_minmax(180px,1fr)]">
          <label className="block">
            <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">Proveedor</span>
            <select value={idProveedor} onChange={(event) => cambiarProveedor(event.target.value)} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
              <option value="">Seleccionar proveedor</option>
              {proveedores.map((proveedor) => <option key={proveedor.id} value={proveedor.id}>{proveedor.descripcion}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">Fecha</span>
            <input type="date" value={fechaOperacion} onChange={(event) => setFechaOperacion(event.target.value)} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
          </label>
          <label className="block">
            <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">Comprobante</span>
            <select value={tipoComprobante} onChange={(event) => setTipoComprobante(event.target.value)} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
              <option>SIN COMPROBANTE</option>
              <option>FACTURA A</option>
              <option>FACTURA B</option>
              <option>FACTURA C</option>
              <option>REMITO</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">Numero</span>
            <input value={numeroComprobante} onChange={(event) => setNumeroComprobante(event.target.value)} placeholder="Opcional" className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
          </label>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-end">
          <label className="inline-flex h-11 items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
            <input type="checkbox" checked={actualizaCostoProveedor} onChange={(event) => setActualizaCostoProveedor(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
            Actualizar costo de compra del proveedor
          </label>
          <textarea value={observacion} onChange={(event) => setObservacion(event.target.value)} rows={2} placeholder="Observaciones de la compra" className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
        </div>
      </section>

      <section className="mt-5 border border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="border-b border-slate-200 p-4 dark:border-slate-800">
          <div className="relative max-w-2xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void buscarCodigoEscaneado();
                }
              }}
              placeholder="Buscar o escanear item, codigo o barra"
              className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>
          {busqueda.trim().length >= 2 && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {isSearching && <p className="text-xs font-bold text-slate-400">Buscando items...</p>}
              {!isSearching && resultados.map((producto) => (
                <button key={producto.id} type="button" onClick={() => agregarProducto(producto)} className="flex min-w-0 items-center justify-between gap-3 border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-blue-500 dark:border-slate-700 dark:bg-slate-950">
                  <span className="min-w-0"><span className="block truncate text-xs font-black text-slate-900 dark:text-white">{producto.descripcion}</span><span className="mt-1 block truncate font-mono text-[10px] font-bold text-slate-500">{producto.cod_unico}</span></span>
                  <Plus className="h-4 w-4 shrink-0 text-blue-500" />
                </button>
              ))}
              {!isSearching && resultados.length === 0 && <p className="text-xs font-bold text-slate-400">No hay coincidencias.</p>}
            </div>
          )}
        </div>

        {lineas.length === 0 ? (
          <div className="flex min-h-52 flex-col items-center justify-center p-8 text-center">
            <PackagePlus className="h-9 w-9 text-slate-300 dark:text-slate-700" />
            <p className="mt-3 text-sm font-bold text-slate-500">Busca o escanea un item para agregarlo a la compra.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1120px] w-full text-left">
              <thead className="bg-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:bg-slate-900">
                <tr>
                  <th className="px-4 py-3">Item</th><th className="px-3 py-3">Codigo prov.</th><th className="px-3 py-3">Cantidad</th><th className="px-3 py-3">Costo neto</th><th className="px-3 py-3">Desc. %</th><th className="px-3 py-3">IVA %</th><th className="px-3 py-3">Ubicacion</th><th className="px-3 py-3 text-right">Subtotal</th><th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {lineas.map((linea, index) => {
                  const netoLinea = linea.cantidad * linea.costoUnitario * (1 - linea.descuento / 100);
                  const subtotal = netoLinea * (1 + linea.iva / 100);
                  const series = parseSeries(linea.seriesTexto);
                  return (
                    <tr key={linea.producto.id} className="border-t border-slate-200 align-top dark:border-slate-800">
                      <td className="min-w-72 px-4 py-3"><div className="truncate text-sm font-black text-slate-900 dark:text-white">{linea.producto.descripcion}</div><div className="mt-1 font-mono text-[10px] font-bold text-slate-500">{linea.producto.cod_unico}</div>{linea.producto.usa_numero_serie && <textarea value={linea.seriesTexto} onChange={(event) => actualizarLinea(index, "seriesTexto", event.target.value)} rows={2} placeholder="Escanea o pega una serie por linea" className="mt-3 w-full resize-y rounded-lg border border-blue-500/30 bg-blue-500/5 px-2 py-1.5 font-mono text-xs font-bold text-slate-900 outline-none focus:border-blue-500 dark:text-white" />}{linea.producto.usa_numero_serie && <p className={`mt-1 text-[10px] font-bold ${series.length === linea.cantidad ? "text-emerald-500" : "text-amber-500"}`}>{series.length}/{linea.cantidad} series cargadas</p>}</td>
                      <td className="px-3 py-3"><input value={linea.codigoProveedor} onChange={(event) => actualizarLinea(index, "codigoProveedor", event.target.value.toUpperCase())} className="h-10 w-36 rounded-lg border border-slate-200 bg-white px-2 font-mono text-xs font-bold text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></td>
                      <td className="px-3 py-3"><input type="number" min="1" step="1" value={linea.cantidad} onChange={(event) => actualizarLinea(index, "cantidad", Number(event.target.value))} className="h-10 w-20 rounded-lg border border-slate-200 bg-white px-2 text-center text-sm font-black text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></td>
                      <td className="px-3 py-3"><input type="number" min="0" step="0.01" value={linea.costoUnitario} onChange={(event) => actualizarLinea(index, "costoUnitario", Number(event.target.value))} className="h-10 w-32 rounded-lg border border-slate-200 bg-white px-2 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></td>
                      <td className="px-3 py-3"><input type="number" min="0" max="100" step="0.01" value={linea.descuento} onChange={(event) => actualizarLinea(index, "descuento", Number(event.target.value))} className="h-10 w-20 rounded-lg border border-slate-200 bg-white px-2 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></td>
                      <td className="px-3 py-3"><select value={linea.iva} onChange={(event) => actualizarLinea(index, "iva", Number(event.target.value))} className="h-10 w-24 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value={0}>0%</option><option value={10.5}>10.5%</option><option value={21}>21%</option><option value={27}>27%</option></select></td>
                      <td className="px-3 py-3"><select value={linea.idUbicacion ?? ""} onChange={(event) => actualizarLinea(index, "idUbicacion", event.target.value ? Number(event.target.value) : null)} className="h-10 min-w-44 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="">Seleccionar</option>{ubicaciones.map((ubicacion) => <option key={ubicacion.id} value={ubicacion.id}>{ubicacion.descripcion}</option>)}</select></td>
                      <td className="px-3 py-3 text-right text-sm font-black text-slate-900 dark:text-white">{formatMoney(subtotal)}</td>
                      <td className="px-3 py-3 text-right"><button type="button" onClick={() => setLineas((actuales) => actuales.filter((_, lineaIndex) => lineaIndex !== index))} className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-500/10 hover:text-red-500" title="Quitar item"><Trash2 className="h-4 w-4" /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="sticky bottom-0 mt-5 border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-800 dark:bg-slate-950">
        <div className="grid gap-3 text-sm sm:grid-cols-3 sm:justify-end">
          <div className="sm:text-right"><span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Neto</span><div className="mt-1 font-black text-slate-900 dark:text-white">{formatMoney(resumen.neto)}</div></div>
          <div className="sm:text-right"><span className="text-[10px] font-black uppercase tracking-widest text-slate-500">IVA</span><div className="mt-1 font-black text-slate-900 dark:text-white">{formatMoney(resumen.iva)}</div></div>
          <div className="border-t border-slate-200 pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0 sm:text-right dark:border-slate-800"><span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total</span><div className="mt-1 text-xl font-black text-emerald-500">{formatMoney(resumen.total)}</div></div>
        </div>
      </section>
    </main>
  );
}
