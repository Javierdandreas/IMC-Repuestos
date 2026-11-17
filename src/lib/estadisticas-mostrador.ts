import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/api-errors";
import { periodoEstadisticasVentas, fechasPeriodoVentas } from "@/lib/periodo-estadisticas-ventas";

const amount = z.number().finite().nonnegative();
const kpisSchema = z.object({ montoTotal:amount, unidadesVendidas:amount, lineasVendidas:amount, operaciones:amount, productosDistintos:amount, ticketPromedio:amount });
const rankingSchema = z.object({ codigo:z.string(), descripcion:z.string(), marca:z.string().nullable(), unidadesVendidas:amount,
  montoTotal:amount, precioPromedio:amount, operaciones:amount, unidadesSeparadas:amount, unidadesNoEncontradas:amount, ultimaVentaAt:z.string().nullable() });
const pageSchema = z.object({ pagina:z.number().int().positive(), limit:z.number().int().positive(), totalItems:amount, totalPaginas:amount, tieneMas:z.boolean() });
const resumenSchema = z.object({ generadoEn:z.string(), kpis:kpisSchema, paginacion:pageSchema, items:z.array(rankingSchema) });
const seriesSchema = z.object({ series:z.array(z.object({ fecha:z.string().regex(/^\d{4}-\d{2}-\d{2}$/), unidadesVendidas:amount, montoTotal:amount })) });
const ventaSchema = z.object({ itemId:z.number().int(), fechaVentaUtc:z.string(), codigo:z.string(), descripcion:z.string(), marca:z.string().nullable(),
  unidadesVendidas:amount, precioUnitario:amount, monto:amount, presupuestoCodigo:z.string(), envioCodigo:z.string().nullable(),
  estadoDeposito:z.enum(["separado","pendiente","no_encontrado"]), vendedor:z.string().nullable() });
const ventasSchema = z.object({ generadoEn:z.string(), ventas:z.array(ventaSchema),
  paginacion:z.object({ limit:z.number().int().positive(), cantidadDevuelta:amount, nextCursor:z.string().nullable(), tieneMas:z.boolean() }) });

export const consultaEstadisticasMostradorSchema = z.object({
  dias:z.coerce.number().int().refine((n) => [1,7,30,90,365].includes(n)).default(30),
  hasta:z.iso.datetime({offset:true}).optional(),
  q:z.string().trim().max(120).optional(),
  estadoDeposito:z.enum(["separado","pendiente","no_encontrado"]).optional(),
  incluirNoEncontrados:z.enum(["true","false"]).default("true").transform((v) => v==="true"),
  pagina:z.coerce.number().int().min(1).max(100000).default(1),
  cursor:z.string().min(1).max(2000).optional(),
  vista:z.enum(["resumen","ventas"]).default("resumen"),
});
type Consulta = z.infer<typeof consultaEstadisticasMostradorSchema>;
export type MostradorEstadisticas = {
  periodo:{ dias:number; desde:string; hasta:string; desdeAnterior:string; hastaAnterior:string };
  generadoEn:string; moneda:"ARS"; actual:z.infer<typeof kpisSchema>; anterior:z.infer<typeof kpisSchema>;
  items:z.infer<typeof rankingSchema>[]; paginacion:z.infer<typeof pageSchema>;
  evolucion:Array<{fecha:string; montoTotal:number; unidadesVendidas:number}>;
};
export type MostradorVentas = z.infer<typeof ventasSchema>;

async function consultarMostrador<T>(recurso:string, params:URLSearchParams, schema:z.ZodType<T>):Promise<T> {
  const key=process.env.MOSTRADOR_ESTADISTICAS_API_KEY?.trim();
  if (!key) throw new AppError("Falta configurar la API de estadisticas de mostrador.",503);
  let url:URL;
  try {
    const base=new URL(process.env.MOSTRADOR_ESTADISTICAS_URL || "https://imc-cerebro.vercel.app");
    if(base.protocol!=="https:" || base.username || base.password) throw new Error();
    url=new URL(`/api/v1/estadisticas/${recurso}`,base);
    url.search=params.toString();
  } catch { throw new AppError("La URL de estadisticas de mostrador no es valida.",503); }
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),15000);
  try {
    const response=await fetch(url,{headers:{"X-API-Key":key,Accept:"application/json"},cache:"no-store",signal:controller.signal,redirect:"error"});
    if(!response.ok) throw new AppError(response.status===401 ? "La API de mostrador rechazo la clave configurada." : `La API de mostrador devolvio HTTP ${response.status}.`,502);
    const parsed=schema.safeParse(await response.json());
    if(!parsed.success) throw new AppError("La API de mostrador devolvio datos de estadisticas incompletos o invalidos.",502);
    return parsed.data;
  } catch(error) {
    if(error instanceof AppError) throw error;
    throw new AppError(controller.signal.aborted ? "La API de mostrador excedio el tiempo de respuesta." : "No se pudo consultar la API de estadisticas de mostrador.",502);
  } finally {clearTimeout(timeout);}
}

function parametros(input:Consulta, desde:Date, hasta:Date) {
  const params=new URLSearchParams({desde:desde.toISOString(),hasta:hasta.toISOString(),incluirNoEncontrados:String(input.incluirNoEncontrados)});
  if(input.q) params.set("q",input.q);
  if(input.estadoDeposito) params.set("estadoDeposito",input.estadoDeposito);
  return params;
}

export async function getEstadisticasMostrador(input:Consulta):Promise<MostradorEstadisticas> {
  const periodo=periodoEstadisticasVentas(input.dias,input.hasta?new Date(input.hasta):new Date());
  const current=parametros(input,periodo.desde,periodo.hasta);
  const previous=parametros(input,periodo.desdeAnterior,periodo.hastaAnterior);
  const [actual,anterior,series]=await Promise.all([
    consultarMostrador("resumen",new URLSearchParams([...current, ["pagina",String(input.pagina)],["limit","20"],["orden","unidades"]]),resumenSchema),
    consultarMostrador("resumen",new URLSearchParams([...previous,["limit","1"]]),resumenSchema),
    consultarMostrador("series",new URLSearchParams([...current,["agruparPor","dia"]]),seriesSchema),
  ]);
  const porFecha=new Map(series.series.map((s)=>[s.fecha,s]));
  return {periodo:{dias:periodo.dias,desde:periodo.desde.toISOString(),hasta:periodo.hasta.toISOString(),desdeAnterior:periodo.desdeAnterior.toISOString(),hastaAnterior:periodo.hastaAnterior.toISOString()},
    generadoEn:actual.generadoEn,moneda:"ARS",actual:actual.kpis,anterior:anterior.kpis,items:actual.items,paginacion:actual.paginacion,
    evolucion:fechasPeriodoVentas(periodo.desde,periodo.dias).map((fecha)=>({fecha,montoTotal:porFecha.get(fecha)?.montoTotal??0,unidadesVendidas:porFecha.get(fecha)?.unidadesVendidas??0}))};
}

export async function getVentasMostrador(input:Consulta):Promise<MostradorVentas> {
  const periodo=periodoEstadisticasVentas(input.dias,input.hasta?new Date(input.hasta):new Date());
  const params=parametros(input,periodo.desde,periodo.hasta);
  params.set("limit","20");params.set("orden","reciente");
  if(input.cursor) params.set("cursor",input.cursor);
  return consultarMostrador("ventas",params,ventasSchema);
}
