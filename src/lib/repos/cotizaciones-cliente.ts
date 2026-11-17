import { randomUUID } from "crypto";
import { z } from "zod";
import { withTransaction } from "@/lib/db-utils";
import { AppError } from "@/lib/api-errors";
import { calcularPrecioCliente, resolverDescuentoCliente, type ReglaDescuentoCliente } from "@/lib/descuentos-cliente";

export const cotizacionClienteSchema = z.object({
  tipoDocumento: z.enum(["DNI", "CUIT"]),
  numeroDocumento: z.string().trim().max(32).regex(/^[\d.\s-]+$/).transform((v) => v.replace(/\D/g, "")).pipe(z.string().regex(/^\d{6,11}$/)),
  items: z.array(z.object({
    codigo: z.string().trim().min(1).max(120).transform((v) => v.toUpperCase()),
    tipo: z.enum(["ITEM", "KIT"]).optional(),
    cantidad: z.number().int().positive().max(10000),
  })).min(1).max(100),
  cotizacionAnteriorId: z.uuid().optional(),
});

type Articulo = {
  tipo: "ITEM" | "KIT"; id: number; codigo: string; descripcion: string;
  id_marca: number | null; id_categoria: number | null; id_subcategoria: number | null;
  activo: boolean; precio: string | null; stock: number; completo: boolean;
  consumos: Array<{ id: number; cantidad: number; stock: number }>;
};
type Linea = {
  codigo: string; tipo: "ITEM" | "KIT" | null; cantidad: number;
  encontrado: boolean;
  descripcion: string | null; precioUnitarioFinal: number | null; subtotal: number | null;
  stockDisponible: number; stockSuficiente: boolean; error: string | null;
};
export type CotizacionCliente = {
  cotizacionId: string; cotizadoAt: string; moneda: "ARS";
  ivaIncluido: true;
  clienteEncontrado: true; items: Linea[]; total: number | null; puedeConfirmar: boolean;
  stockReservado: false; requiereConfirmarCambios: boolean; cambiosPrecio: string[];
};

export async function cotizarCliente(input: z.infer<typeof cotizacionClienteSchema>) {
  return withTransaction(async (db) => {
    await db.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    const clients = await db.query<{ id: number; id_tipo_precio: number | null; bonificacion_general: string }>(`
      SELECT id, id_tipo_precio, bonificacion_general FROM public.clientes
      WHERE activo=TRUE AND UPPER(BTRIM(tipo_documento))=$1
        AND REGEXP_REPLACE(COALESCE(documento,''), '[^0-9]', '', 'g')=$2 LIMIT 2`, [input.tipoDocumento, input.numeroDocumento]);
    if (!clients.rowCount) throw new AppError("Cliente activo no encontrado.", 404);
    if (clients.rowCount !== 1) throw new AppError("Hay mas de un cliente activo con ese documento. Revisar en Nexo.", 409);
    const cliente = clients.rows[0];
    const listas = await db.query<{ id: number }>(`SELECT id FROM public.tipo_precio WHERE activo=TRUE
      AND (($1::int IS NOT NULL AND id=$1) OR ($1::int IS NULL AND UPPER(BTRIM(descripcion))='MOSTRADOR'))
      AND UPPER(BTRIM(descripcion)) NOT IN ('PRECIO COSTO','MERCADO LIBRE','MERCADOLIBRE') ORDER BY id LIMIT 1`, [cliente.id_tipo_precio]);
    if (!listas.rowCount) throw new AppError("El cliente no tiene una lista de venta valida para cotizar. Revisar en Nexo.", 422);
    const lista = listas.rows[0].id;
    const rules = await db.query<ReglaDescuentoCliente>(`SELECT id_marca, id_categoria, id_subcategoria, descuento::float
      FROM public.cliente_regla_descuento WHERE id_cliente=$1 ORDER BY id`, [cliente.id]);
    const codes = [...new Set(input.items.map((i) => i.codigo))];
    const articulos = await db.query<Articulo>(`
      SELECT 'ITEM' AS tipo, p.id, p.cod_unico AS codigo, p.descripcion, p.id_marca,
        s.id_categoria, p.id_subcategoria, p.activo, precio.precio,
        GREATEST(COALESCE(p.stock,0),0)::int AS stock, TRUE AS completo,
        jsonb_build_array(jsonb_build_object('id',p.id,'cantidad',1,'stock',GREATEST(COALESCE(p.stock,0),0))) AS consumos
      FROM public.productos p LEFT JOIN public.subcategoria s ON s.id=p.id_subcategoria
      LEFT JOIN public.producto_precio precio ON precio.id_producto=p.id AND precio.id_tipo_precio=$2
      WHERE UPPER(BTRIM(p.cod_unico))=ANY($1::text[])
      UNION ALL
      SELECT 'KIT', k.id, k.codigo_kit, COALESCE(NULLIF(k.descripcion,''), k.nombre), k.id_marca,
        COALESCE(k.id_categoria,s.id_categoria), k.id_subcategoria, k.activo,
        CASE WHEN k.criterio_costo='MANUAL' THEN MAX(manual.precio)
          ELSE SUM(cp.precio*d.cantidad) END AS precio,
        COALESCE(MIN(FLOOR(GREATEST(COALESCE(p.stock,0),0)/NULLIF(d.cantidad,0))),0)::int AS stock,
        COUNT(d.id_producto)>0 AND BOOL_AND(COALESCE(p.id IS NOT NULL AND p.activo=TRUE AND d.cantidad>0
          AND (k.criterio_costo='MANUAL' OR cp.precio>0), FALSE)) AS completo,
        COALESCE(jsonb_agg(jsonb_build_object('id',p.id,'cantidad',d.cantidad,'stock',GREATEST(COALESCE(p.stock,0),0))) FILTER (WHERE p.id IS NOT NULL),'[]'::jsonb) AS consumos
      FROM public.kits k LEFT JOIN public.subcategoria s ON s.id=k.id_subcategoria
      LEFT JOIN public.kit_detalle d ON d.id_kit=k.id
      LEFT JOIN public.productos p ON p.id=d.id_producto
      LEFT JOIN public.producto_precio cp ON cp.id_producto=p.id AND cp.id_tipo_precio=$2
      LEFT JOIN public.kit_precio manual ON manual.id_kit=k.id AND manual.id_tipo_precio=$2
      WHERE UPPER(BTRIM(k.codigo_kit))=ANY($1::text[])
      GROUP BY k.id,s.id_categoria`, [codes, lista]);

    const auditoria: unknown[] = [];
    const seen = new Set<string>();
    const demanda = new Map<number, number>();
    const consumosPorLinea: Articulo["consumos"][] = [];
    const items: Linea[] = input.items.map((linea) => {
      const candidates = articulos.rows.filter((r) => r.codigo.trim().toUpperCase() === linea.codigo && (!linea.tipo || r.tipo === linea.tipo));
      const articulo = candidates.length === 1 ? candidates[0] : null;
      const key = `${articulo?.tipo ?? linea.tipo ?? "?"}:${linea.codigo}`;
      if (seen.has(key)) throw new AppError("Un codigo no puede repetirse en la cotizacion; suma sus cantidades.", 400);
      seen.add(key);
      const error = !candidates.length ? "CODIGO_NO_ENCONTRADO" : candidates.length > 1 ? "CODIGO_AMBIGUO"
        : !articulo!.activo ? "ARTICULO_INACTIVO" : !articulo!.completo ? "KIT_INCOMPLETO"
        : !(Number(articulo!.precio) > 0) || !Number.isFinite(Number(articulo!.precio)) || Number(articulo!.precio)>1e11 ? "SIN_PRECIO" : null;
      let precioUnitarioFinal: number | null = null;
      if (!error && articulo) {
        const resolved = resolverDescuentoCliente(rules.rows, articulo, Number(cliente.bonificacion_general));
        // Las listas de venta ya contienen IVA: el descuento se aplica al final,
        // igual que precioMostrador; no se vuelve a sumar el impuesto.
        precioUnitarioFinal = calcularPrecioCliente(Number(articulo.precio), resolved.descuento);
        auditoria.push({ codigo: linea.codigo, tipo: articulo.tipo, id: articulo.id, precioLista: articulo.precio,
          lista, descuento: resolved.descuento, regla: resolved.regla });
      }
      const stockDisponible = articulo?.completo ? Number(articulo.stock) : 0;
      const consumos = !error && articulo ? articulo.consumos : [];
      consumosPorLinea.push(consumos);
      for (const c of consumos) demanda.set(c.id,(demanda.get(c.id) ?? 0)+Number(c.cantidad)*linea.cantidad);
      const subtotalCentavos = precioUnitarioFinal === null ? null : Math.round(precioUnitarioFinal*100)*linea.cantidad;
      if (subtotalCentavos !== null && !Number.isSafeInteger(subtotalCentavos)) throw new AppError("El importe de la linea excede el maximo permitido.",422);
      return { codigo: linea.codigo, tipo: articulo?.tipo ?? linea.tipo ?? null, cantidad: linea.cantidad,
        encontrado: candidates.length > 0,
        descripcion: articulo?.descripcion ?? null, precioUnitarioFinal,
        subtotal: subtotalCentavos === null ? null : subtotalCentavos/100,
        stockDisponible, stockSuficiente: stockDisponible >= linea.cantidad, error };
    });
    // Un componente compartido entre dos kits o un item y un kit se consume una sola vez.
    items.forEach((item,index) => {
      if (consumosPorLinea[index].some((c) => (demanda.get(c.id) ?? 0)>Number(c.stock))) item.stockSuficiente=false;
    });
    const totalCentavos = items.some((i) => i.error) ? null : items.reduce((sum,i) => sum+Math.round(i.subtotal!*100),0);
    if (totalCentavos !== null && !Number.isSafeInteger(totalCentavos)) throw new AppError("El total excede el maximo permitido.",422);
    const cambiosPrecio: string[] = [];
    if (input.cotizacionAnteriorId) {
      const anterior = await db.query<{ respuesta: CotizacionCliente; solicitud: typeof input.items | null }>(
        "SELECT respuesta, calculo_interno->'solicitud' AS solicitud FROM public.partner_cotizacion WHERE id=$1 AND id_cliente=$2", [input.cotizacionAnteriorId, cliente.id]);
      if (!anterior.rowCount) throw new AppError("La cotizacion anterior no existe para este cliente.", 404);
      const prev = anterior.rows[0].respuesta.items;
      const solicitudAnterior = anterior.rows[0].solicitud;
      const indicesPrevios = input.items.map((r) => solicitudAnterior
        ? solicitudAnterior.findIndex((p) => p.codigo===r.codigo && (p.tipo ?? null)===(r.tipo ?? null) && p.cantidad===r.cantidad)
        : prev.findIndex((p) => p.codigo===r.codigo && (!r.tipo || p.tipo===r.tipo) && p.cantidad===r.cantidad));
      if (prev.length !== items.length || indicesPrevios.some((index) => index<0) || new Set(indicesPrevios).size!==items.length) {
        throw new AppError("Para comparar precios, los articulos y cantidades deben coincidir con la cotizacion anterior.", 400);
      }
      items.forEach((item,index) => {
        if (prev[indicesPrevios[index]].precioUnitarioFinal!==item.precioUnitarioFinal) cambiosPrecio.push(item.codigo);
      });
    }
    const cotizadoAt = new Date().toISOString();
    const respuesta: CotizacionCliente = { cotizacionId: randomUUID(), cotizadoAt, moneda: "ARS", ivaIncluido: true, clienteEncontrado: true,
      items, total: totalCentavos === null ? null : totalCentavos/100,
      puedeConfirmar: items.every((i) => !i.error && i.stockSuficiente) && cambiosPrecio.length===0,
      stockReservado: false, requiereConfirmarCambios: cambiosPrecio.length>0, cambiosPrecio };
    await db.query(`INSERT INTO public.partner_cotizacion (id,id_cliente,created_at,respuesta,calculo_interno)
      VALUES ($1,$2,$3,$4::jsonb,$5::jsonb)`, [respuesta.cotizacionId,cliente.id,cotizadoAt,JSON.stringify(respuesta),JSON.stringify({lista,bonificacionGeneral: cliente.bonificacion_general, solicitud:input.items, lineas:auditoria})]);
    return respuesta;
  });
}
