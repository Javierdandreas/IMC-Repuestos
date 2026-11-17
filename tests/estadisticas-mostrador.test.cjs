const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const periods=require('../src/lib/periodo-estadisticas-ventas.ts');
const kpis={montoTotal:100,unidadesVendidas:2,lineasVendidas:1,operaciones:1,productosDistintos:1,ticketPromedio:100};
const ranking={generadoEn:'2026-11-17T18:00:00Z',kpis,paginacion:{pagina:1,limit:20,totalItems:1,totalPaginas:1,tieneMas:false},items:[{codigo:'ABC',descripcion:'Filtro',marca:null,unidadesVendidas:2,montoTotal:100,precioPromedio:50,operaciones:1,unidadesSeparadas:2,unidadesNoEncontradas:0,ultimaVentaAt:'2026-11-17T17:00:00Z'}]};
function load(fetcher){
  class AppError extends Error{constructor(message,status){super(message);this.status=status;}}
  const deps={'server-only':{},'@/lib/api-errors':{AppError},'@/lib/periodo-estadisticas-ventas':periods};
  const source=ts.transpileModule(fs.readFileSync('src/lib/estadisticas-mostrador.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  const mod={exports:{}};
  new Function('require','exports','fetch',source)((id)=>deps[id]||require(id),mod.exports,fetcher);
  return mod.exports;
}
test('mostrador usa autenticacion del servidor, mismas fechas y totales del rango completo',async(t)=>{
  const before=process.env.MOSTRADOR_ESTADISTICAS_API_KEY;
  process.env.MOSTRADOR_ESTADISTICAS_API_KEY='secret-only-for-tests';
  try{
    const calls=[];
    const repo=load(async(url,options)=>{
      calls.push({url,options});
      return {ok:true,json:async()=>url.pathname.endsWith('/series')?{series:[{fecha:'2026-11-17',unidadesVendidas:2,montoTotal:100}]}:url.pathname.endsWith('/ventas')?{generadoEn:ranking.generadoEn,ventas:[],paginacion:{limit:20,cantidadDevuelta:0,nextCursor:null,tieneMas:false}}:ranking};
    });
    const input=repo.consultaEstadisticasMostradorSchema.parse({dias:'7',hasta:'2026-11-17T18:00:00Z',pagina:'2',incluirNoEncontrados:'false',estadoDeposito:'separado',q:'Filtro'});
    await t.test('resumen y serie alineados, sin sumar solo la pagina de ranking',async()=>{
      const result=await repo.getEstadisticasMostrador(input);
      assert.equal(result.actual.montoTotal,100);
      assert.equal(result.evolucion.length,7);
      assert.equal(result.evolucion.at(-1).fecha,'2026-11-17');
      assert.equal(result.evolucion[0].montoTotal,0);
      assert.equal(calls.length,3);
      for(const c of calls){assert.equal(c.options.headers['X-API-Key'],'secret-only-for-tests');assert.equal(c.options.cache,'no-store');assert.equal(c.options.redirect,'error');assert.equal(c.url.searchParams.get('incluirNoEncontrados'),'false');assert.equal(c.url.searchParams.get('estadoDeposito'),'separado');}
      assert.equal(calls[0].url.searchParams.get('pagina'),'2');
      assert.equal(calls[0].url.searchParams.get('desde'),'2026-11-11T03:00:00.000Z');
      assert.equal(calls[1].url.searchParams.get('hasta'),'2026-11-10T18:00:00.000Z');
      assert.ok(!JSON.stringify(result).includes('secret-only-for-tests'));
    });
    await t.test('cursor y orden reciente pasan a la consulta de movimientos',async()=>{
      const result=await repo.getVentasMostrador({...input,cursor:'cursor-prueba'});
      assert.deepEqual(result.ventas,[]);
      assert.equal(calls.at(-1).url.searchParams.get('cursor'),'cursor-prueba');
      assert.equal(calls.at(-1).url.searchParams.get('orden'),'reciente');
    });
    await t.test('error o respuesta incompleta no inventa ceros',async()=>{
      const bad=load(async()=>({ok:true,json:async()=>({})}));
      await assert.rejects(()=>bad.getEstadisticasMostrador(input),e=>e.status===502);
      const denied=load(async()=>({ok:false,status:401}));
      await assert.rejects(()=>denied.getVentasMostrador(input),e=>e.status===502&&!e.message.includes('secret-only-for-tests'));
    });
    await t.test('sin clave local devuelve error de configuracion antes de llamar',async()=>{
      delete process.env.MOSTRADOR_ESTADISTICAS_API_KEY;
      const off=load(async()=>{throw new Error('No llamar');});
      await assert.rejects(()=>off.getVentasMostrador(input),e=>e.status===503);
    });
  }finally{if(before===undefined)delete process.env.MOSTRADOR_ESTADISTICAS_API_KEY;else process.env.MOSTRADOR_ESTADISTICAS_API_KEY=before;}
});

test('contrato de la API de mostrador real',{skip:process.env.IMC_MOSTRADOR_LIVE_TEST!=='1'},async()=>{
  require('dotenv').config({path:'.env.local',quiet:true});
  const repo=load(fetch);
  const input=repo.consultaEstadisticasMostradorSchema.parse({dias:1});
  const result=await repo.getEstadisticasMostrador(input);
  assert.ok(result.actual.montoTotal>=0);
  assert.equal(result.evolucion.length,1);
  const movimientos=await repo.getVentasMostrador(input);
  assert.ok(movimientos.ventas.length<=20);
});
