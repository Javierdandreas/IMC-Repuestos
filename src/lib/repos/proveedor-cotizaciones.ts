import { AppError } from "@/lib/api-errors";
import { query, withTransaction } from "@/lib/db-utils";
import { getPanelMultimoneda } from "@/lib/multimoneda";

export type CotizacionProveedorInput = {
  codigo: string;
  activa: boolean;
  lado: "COMPRA" | "VENTA";
  tipoRecargo: "PORCENTAJE" | "MONTO_FIJO";
  recargo: number;
};

export async function getCotizacionesProveedor(idProveedor: number) {
  const [panel, saved] = await Promise.all([
    getPanelMultimoneda(),
    query<{ codigo: string; lado: "COMPRA" | "VENTA"; tipo_recargo: "PORCENTAJE" | "MONTO_FIJO"; recargo: string }>(
      "SELECT codigo, lado, tipo_recargo, recargo FROM public.proveedor_cotizacion_configuracion WHERE id_proveedor = $1", [idProveedor],
    ),
  ]);
  return panel.cotizaciones.filter((quote) => quote.moneda !== "ARS").map((quote) => {
    const selected = saved.rows.find((row) => row.codigo === quote.codigo);
    return {
      codigo: quote.codigo, etiqueta: quote.etiqueta, moneda: quote.moneda, referencia: quote.referencia,
      activa: Boolean(selected), lado: selected?.lado ?? "VENTA", tipoRecargo: selected?.tipo_recargo ?? "PORCENTAJE",
      recargo: Number(selected?.recargo ?? 0), valorCompra: quote.valorCompra, valorVenta: quote.valorVenta,
    };
  });
}

export async function saveCotizacionesProveedor(idProveedor: number, inputs: CotizacionProveedorInput[]) {
  if (new Set(inputs.map((input) => input.codigo)).size !== inputs.length) throw new AppError("Hay cotizaciones repetidas.", 400);
  await withTransaction(async (client) => {
    const provider = await client.query("SELECT id FROM public.proveedores WHERE id = $1", [idProveedor]);
    if (!provider.rowCount) throw new AppError("Proveedor no encontrado.", 404);
    const active = inputs.filter((input) => input.activa);
    const valid = await client.query<{ codigo: string }>(
      "SELECT codigo FROM public.moneda_cotizacion_configuracion WHERE moneda <> 'ARS' AND codigo = ANY($1::text[])",
      [active.map((input) => input.codigo)],
    );
    if (valid.rows.length !== active.length) throw new AppError("Hay cotizaciones invalidas.", 400);
    await client.query("DELETE FROM public.proveedor_cotizacion_configuracion WHERE id_proveedor = $1", [idProveedor]);
    for (const input of active) {
      await client.query(
        `INSERT INTO public.proveedor_cotizacion_configuracion (id_proveedor, codigo, lado, tipo_recargo, recargo)
         VALUES ($1, $2, $3, $4, $5)`,
        [idProveedor, input.codigo, input.lado, input.tipoRecargo, input.recargo],
      );
    }
  });
  return getCotizacionesProveedor(idProveedor);
}
