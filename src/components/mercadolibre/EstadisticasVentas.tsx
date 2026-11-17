"use client";

import { useEffect,useState } from "react";
import useSWR from "swr";
import { RefreshCcw,ChevronLeft,ChevronRight } from "lucide-react";
import type { MercadoLibreEstadisticas } from "@/interfaces/mercadolibre";
import type { MostradorEstadisticas,MostradorVentas } from "@/lib/estadisticas-mostrador";
import { MercadoLibreStats } from "@/components/mercadolibre/MercadoLibreStats";

const base="/api/integraciones/mercadolibre/estadisticas";
async function fetchStats<T>(url:string):Promise<T> {
  const response=await fetch(url,{cache:"no-store"});
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.message||"No se pudieron consultar las estadisticas.");
  return data as T;
}
const money=(v:number)=>v.toLocaleString("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0});
const number=(v:number)=>v.toLocaleString("es-AR");
const date=(v:string)=>new Intl.DateTimeFormat("es-AR",{timeZone:"America/Argentina/Buenos_Aires",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(v));
const control="h-9 min-w-0 rounded-md border border-slate-300 bg-white px-3 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-white";
const button="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-slate-300 px-3 text-xs font-bold text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300";
const swrOptions={errorRetryCount:1,revalidateOnFocus:false};
function ErrorLine({error}:{error:Error|undefined}) {return error?<p role="alert" className="border border-red-300 bg-red-50 p-3 text-xs font-bold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error.message}</p>:null;}
function Change({actual,anterior}:{actual:number;anterior:number}) {return <span className="text-[10px] font-bold text-slate-500">{anterior ? `${((actual-anterior)/anterior*100).toLocaleString("es-AR",{maximumFractionDigits:1})}% frente al periodo anterior` : "Sin base anterior"}</span>;}

export function EstadisticasVentas({idCuenta}:{idCuenta:number}) {
  const [canal,setCanal]=useState<"COMPARAR"|"MERCADO_LIBRE"|"MOSTRADOR">("COMPARAR");
  const [dias,setDias]=useState(30);
  const [corte,setCorte]=useState(()=>new Date().toISOString());
  useEffect(()=>{const timer=setInterval(()=>setCorte(new Date().toISOString()),60000);return()=>clearInterval(timer);},[]);
  const suffix=new URLSearchParams({dias:String(dias),hasta:corte}).toString();
  const ml=useSWR<MercadoLibreEstadisticas>(canal==="COMPARAR"?`${base}?idCuenta=${idCuenta}&${suffix}`:null,fetchStats,swrOptions);
  const mostrador=useSWR<MostradorEstadisticas>(canal==="COMPARAR"?`${base}/mostrador?${suffix}`:null,fetchStats,swrOptions);
  const mlPorFecha=new Map(ml.data?.evolucion.map((r)=>[r.fecha,r.facturacion]));
  const mostPorFecha=new Map(mostrador.data?.evolucion.map((r)=>[r.fecha,r.montoTotal]));
  const fechas=mostrador.data?.evolucion.map((r)=>r.fecha)||ml.data?.evolucion.map((r)=>r.fecha)||[];
  const max=Math.max(1,...fechas.flatMap((f)=>[mlPorFecha.get(f)||0,mostPorFecha.get(f)||0]));

  return <section className="space-y-5" aria-label="Estadisticas de ventas por canal">
    <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
      <h2 className="text-lg font-black text-slate-900 dark:text-white">Estadisticas de ventas</h2>
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-[10px] font-bold text-slate-500">Canal<select aria-label="Canal de estadisticas" className={control} value={canal} onChange={(e)=>setCanal(e.target.value as typeof canal)}><option value="COMPARAR">Comparar canales</option><option value="MERCADO_LIBRE">Mercado Libre</option><option value="MOSTRADOR">Mostrador</option></select></label>
        <label className="grid gap-1 text-[10px] font-bold text-slate-500">Periodo<select aria-label="Periodo de ventas" className={control} value={dias} onChange={(e)=>setDias(Number(e.target.value))}><option value={1}>Hoy</option><option value={7}>Ultimos 7 dias</option><option value={30}>Ultimos 30 dias</option><option value={90}>Ultimos 90 dias</option><option value={365}>Ultimo ano</option></select></label>
        <button type="button" title="Actualizar ambos canales" aria-label="Actualizar estadisticas de ventas" onClick={()=>setCorte(new Date().toISOString())} className={`${control} inline-grid w-9 place-items-center px-0`}><RefreshCcw className="h-4 w-4" /></button>
      </div>
    </header>
    {canal==="MERCADO_LIBRE" && <MercadoLibreStats idCuenta={idCuenta} dias={dias} hasta={corte} />}
    {canal==="MOSTRADOR" && <EstadisticasMostrador key={dias} dias={dias} hasta={corte} />}
    {canal==="COMPARAR" && <>
      <ErrorLine error={ml.error}/><ErrorLine error={mostrador.error}/>
      <p className="text-xs text-slate-500">Mostrador: pedidos confirmados enviados a deposito. Mercado Libre: ventas pagadas. Importes en ARS.</p>
      <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs"><thead className="border-b border-slate-200 text-[10px] uppercase text-slate-500 dark:border-slate-800"><tr><th className="py-3 pr-4">Canal</th><th className="px-3 text-right">Monto</th><th className="px-3 text-right">Unidades</th><th className="px-3 text-right">Operaciones</th><th className="pl-3 text-right">Ticket promedio</th></tr></thead><tbody className="divide-y divide-slate-200 dark:divide-slate-800">
        <tr><th className="py-4 pr-4 text-cyan-700 dark:text-cyan-300">Mercado Libre</th><td className="px-3 text-right font-mono">{ml.data?money(ml.data.metricas.ventasBrutas.actual):ml.isLoading?"Cargando...":"-"}</td><td className="px-3 text-right">{ml.data?number(ml.data.metricas.unidadesVendidas.actual):"-"}</td><td className="px-3 text-right">{ml.data?number(ml.data.metricas.cantidadVentas.actual):"-"}</td><td className="pl-3 text-right font-mono">{ml.data?money(ml.data.metricas.precioPromedioVenta.actual):"-"}</td></tr>
        <tr><th className="py-4 pr-4 text-emerald-700 dark:text-emerald-300">Mostrador</th><td className="px-3 text-right font-mono">{mostrador.data?money(mostrador.data.actual.montoTotal):mostrador.isLoading?"Cargando...":"-"}</td><td className="px-3 text-right">{mostrador.data?number(mostrador.data.actual.unidadesVendidas):"-"}</td><td className="px-3 text-right">{mostrador.data?number(mostrador.data.actual.operaciones):"-"}</td><td className="pl-3 text-right font-mono">{mostrador.data?money(mostrador.data.actual.ticketPromedio):"-"}</td></tr>
      </tbody></table></div>
      {!!fechas.length && <section className="border-t border-slate-200 pt-4 dark:border-slate-800"><div className="flex flex-wrap justify-between gap-2"><h3 className="text-sm font-bold text-slate-800 dark:text-white">Evolucion diaria por canal</h3><div className="flex gap-3 text-[10px] text-slate-500"><span className="flex items-center gap-1"><i className="h-2 w-2 bg-cyan-600"/>Mercado Libre</span><span className="flex items-center gap-1"><i className="h-2 w-2 bg-emerald-600"/>Mostrador</span></div></div><div className="mt-4 flex h-52 items-end gap-px border-b border-slate-300 dark:border-slate-700">{fechas.map((f)=><div key={f} className="flex h-full min-w-0 flex-1 items-end gap-px" title={`${f} | ML: ${ml.data?money(mlPorFecha.get(f)||0):'Sin datos'} | Mostrador: ${mostrador.data?money(mostPorFecha.get(f)||0):'Sin datos'}`}><span className="flex-1 bg-cyan-600" style={{height:`${(mlPorFecha.get(f)||0)/max*100}%`}}/><span className="flex-1 bg-emerald-600" style={{height:`${(mostPorFecha.get(f)||0)/max*100}%`}}/></div>)}</div><div className="mt-2 flex justify-between text-[10px] text-slate-500"><span>{fechas[0]}</span><span>{fechas.at(-1)}</span></div></section>}
    </>}
  </section>;
}

function EstadisticasMostrador({dias,hasta}:{dias:number;hasta:string}) {
  const [query,setQuery]=useState("");
  const [search,setSearch]=useState("");
  const [deposito,setDeposito]=useState("");
  const [incluir,setIncluir]=useState(true);
  const [pagina,setPagina]=useState(1);
  const [cursors,setCursors]=useState<Array<string|undefined>>([undefined]);
  const [feedPage,setFeedPage]=useState(0);
  useEffect(()=>{const timer=setTimeout(()=>{setSearch(query.trim());setPagina(1);setCursors([undefined]);setFeedPage(0);},350);return()=>clearTimeout(timer);},[query]);
  useEffect(()=>{setCursors([undefined]);setFeedPage(0);},[hasta]);
  const params=new URLSearchParams({dias:String(dias),hasta,incluirNoEncontrados:String(incluir)});
  if(search)params.set("q",search);
  if(deposito)params.set("estadoDeposito",deposito);
  const rankingParams=new URLSearchParams(params);rankingParams.set("pagina",String(pagina));
  const feedParams=new URLSearchParams(params);feedParams.set("vista","ventas");
  if(cursors[feedPage])feedParams.set("cursor",cursors[feedPage]!);
  const stats=useSWR<MostradorEstadisticas>(`${base}/mostrador?${rankingParams}`,fetchStats,swrOptions);
  const feed=useSWR<MostradorVentas>(`${base}/mostrador?${feedParams}`,fetchStats,swrOptions);
  const reset=()=>{setPagina(1);setCursors([undefined]);setFeedPage(0);};
  const data=stats.data;
  const metrics=data?[
    {label:"Pedidos confirmados",actual:data.actual.montoTotal,anterior:data.anterior.montoTotal,money:true},
    {label:"Unidades confirmadas",actual:data.actual.unidadesVendidas,anterior:data.anterior.unidadesVendidas},
    {label:"Operaciones",actual:data.actual.operaciones,anterior:data.anterior.operaciones},
    {label:"Ticket promedio",actual:data.actual.ticketPromedio,anterior:data.anterior.ticketPromedio,money:true},
  ]:[];
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center gap-2"><input aria-label="Buscar ventas de mostrador" placeholder="Codigo, descripcion, marca o presupuesto" value={query} onChange={(e)=>setQuery(e.target.value)} className={`${control} w-full sm:w-80`}/><select aria-label="Estado en deposito" value={deposito} onChange={(e)=>{setDeposito(e.target.value);reset();}} className={control}><option value="">Todos los estados de deposito</option><option value="separado">Separados</option><option value="pendiente">Pendientes</option><option value="no_encontrado">No encontrados</option></select><label className="flex items-center gap-2 text-xs text-slate-500"><input type="checkbox" checked={incluir} onChange={(e)=>{setIncluir(e.target.checked);reset();}}/>Incluir no encontrados</label></div>
    <ErrorLine error={stats.error}/>
    {stats.isLoading&&<p className="py-8 text-sm text-slate-500">Cargando mostrador...</p>}
    {data&&<>
      <div className="grid divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800 sm:grid-cols-2 sm:divide-y-0 xl:grid-cols-4">{metrics.map((m)=><div key={m.label} className="min-w-0 px-3 py-4"><p className="text-[10px] font-bold uppercase text-slate-500">{m.label}</p><p className="mt-2 break-words text-xl font-black text-slate-900 dark:text-white">{m.money?money(m.actual):number(m.actual)}</p><Change actual={m.actual} anterior={m.anterior}/></div>)}</div>
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-bold text-slate-800 dark:text-white">Productos de mostrador</h3><span className="text-[10px] text-slate-500">{data.paginacion.totalItems} productos | Actualizado {date(data.generadoEn)}</span></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="border-b border-slate-200 text-[10px] uppercase text-slate-500 dark:border-slate-800"><tr><th className="py-2 pr-3">Producto</th><th className="px-3 text-right">Unidades</th><th className="px-3 text-right">Monto</th><th className="px-3 text-right">Separadas</th><th className="px-3 text-right">No encontradas</th><th className="pl-3">Ultima venta</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{data.items.map((item)=><tr key={item.codigo}><td className="max-w-80 py-3 pr-3"><p className="font-mono font-bold text-slate-800 dark:text-white">{item.codigo||"Sin codigo"}</p><p className="mt-1 truncate text-slate-500" title={item.descripcion}>{item.descripcion}</p></td><td className="px-3 text-right tabular-nums">{number(item.unidadesVendidas)}</td><td className="px-3 text-right font-mono">{money(item.montoTotal)}</td><td className="px-3 text-right tabular-nums">{number(item.unidadesSeparadas)}</td><td className="px-3 text-right tabular-nums">{number(item.unidadesNoEncontradas)}</td><td className="pl-3 text-[10px] text-slate-500">{item.ultimaVentaAt?date(item.ultimaVentaAt):"-"}</td></tr>)}{!data.items.length&&<tr><td colSpan={6} className="py-8 text-center text-slate-500">Sin ventas en este periodo.</td></tr>}</tbody></table></div>
      <div className="flex items-center justify-end gap-2"><button type="button" title="Pagina anterior de productos" className={button} disabled={pagina<=1||stats.isValidating} onClick={()=>setPagina(pagina-1)}><ChevronLeft className="h-4 w-4"/></button><span className="text-xs text-slate-500">{pagina} / {Math.max(1,data.paginacion.totalPaginas)}</span><button type="button" title="Pagina siguiente de productos" className={button} disabled={!data.paginacion.tieneMas||stats.isValidating} onClick={()=>setPagina(pagina+1)}><ChevronRight className="h-4 w-4"/></button></div>
    </>}
    <section className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800"><h3 className="text-sm font-bold text-slate-800 dark:text-white">Movimientos recientes de mostrador</h3><ErrorLine error={feed.error}/>{feed.isLoading&&<p className="text-xs text-slate-500">Consultando movimientos...</p>}{feed.data&&<><div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left text-xs"><thead className="border-b border-slate-200 text-[10px] uppercase text-slate-500 dark:border-slate-800"><tr><th className="py-2 pr-3">Fecha</th><th className="px-3">Codigo</th><th className="px-3">Presupuesto / Envio</th><th className="px-3">Deposito</th><th className="px-3 text-right">Unidades</th><th className="pl-3 text-right">Monto</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{feed.data.ventas.map((v)=><tr key={v.itemId}><td className="py-3 pr-3 whitespace-nowrap text-slate-500">{date(v.fechaVentaUtc)}</td><td className="px-3 font-mono" title={v.descripcion}>{v.codigo||"Sin codigo"}</td><td className="px-3"><p>{v.presupuestoCodigo}</p><p className="mt-1 text-[10px] text-slate-500">{v.envioCodigo}</p></td><td className="px-3 text-[10px] uppercase text-slate-500">{v.estadoDeposito.replaceAll("_"," ")}</td><td className="px-3 text-right tabular-nums">{number(v.unidadesVendidas)}</td><td className="pl-3 text-right font-mono">{money(v.monto)}</td></tr>)}{!feed.data.ventas.length&&<tr><td colSpan={6} className="py-8 text-center text-slate-500">Sin movimientos.</td></tr>}</tbody></table></div><div className="flex items-center justify-end gap-2"><button type="button" className={button} title="Movimientos anteriores" disabled={feedPage===0||feed.isValidating} onClick={()=>setFeedPage(feedPage-1)}><ChevronLeft className="h-4 w-4"/></button><span className="text-xs text-slate-500">Pagina {feedPage+1}</span><button type="button" className={button} title="Mas movimientos" disabled={!feed.data.paginacion.tieneMas||!feed.data.paginacion.nextCursor||feed.isValidating} onClick={()=>{setCursors([...cursors.slice(0,feedPage+1),feed.data!.paginacion.nextCursor!]);setFeedPage(feedPage+1);}}><ChevronRight className="h-4 w-4"/></button></div></>}</section>
  </div>;
}
