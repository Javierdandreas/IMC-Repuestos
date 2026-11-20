const test=require('node:test');
const assert=require('node:assert/strict');
const {analizarRespuestaClientesGesu:parse,GesuClientesRespuestaError}=require('../src/lib/gesu-clientes-respuesta.ts');

test('acepta registros por indice y arrays con encabezados numericos',()=>{
  const data={id:1,relacion:'Cliente',razonSocial:'Ejemplo'};
  assert.deepEqual(parse({header:{data_tot:'1',data_pag:'1000'},data:{'0':data}}).records,[data]);
  assert.deepEqual(parse({header:{data_tot:1,data_pag:1000},data:[data]}).records,[data]);
  assert.deepEqual(parse({header:{data_tot:0,data_pag:1000},data:[]}).records,[]);
});
test('reconoce el error real de pagina que bloqueaba el cursor en 7',()=>{
  assert.throws(()=>parse({error:'Parámetro pag con valor inválido.'}),e=>e instanceof GesuClientesRespuestaError&&e.codigo==='PAGINA_FUERA_RANGO');
});
test('no confunde limite de consultas con una pagina fuera de rango',()=>{
  assert.throws(()=>parse({error:'Limite de consultas por hora alcanzado'}),e=>e.codigo==='LIMITE_CONSULTAS');
});
test('rechaza paginas incompletas y no expone texto arbitrario del proveedor',()=>{
  for(const value of [null,{},[],{header:{data_tot:1,data_pag:0},data:[]},{header:{data_tot:1,data_pag:1000},data:[null]}]) assert.throws(()=>parse(value));
  assert.throws(()=>parse({error:'token privado 123'}),e=>!e.message.includes('123'));
});

test('una pagina invalida se reinicia sin otra llamada ni importar datos',async()=>{
  const fs=require('node:fs'),ts=require('typescript');
  const source=ts.transpileModule(fs.readFileSync('src/lib/gesu-clientes.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  class AppError extends Error {constructor(message,status){super(message);this.status=status;}}
  let fetches=0,reset=false;
  const deps={'server-only':{},'@/lib/api-errors':{AppError},'@/lib/gesu-clientes-respuesta':require('../src/lib/gesu-clientes-respuesta.ts'),
    '@/lib/db-utils':{query:async(sql,params)=>{
      if(sql.includes('RETURNING pagina_actual'))return{rows:[{pagina_actual:7,ciclo:1}]};
      assert.ok(sql.includes('SET pagina_actual=1'));
      assert.equal(params[1],7);reset=true;return{rows:[]};
    },withTransaction:async()=>{throw new Error('No debe importar una pagina de error');}}};
  const mod={exports:{}};
  new Function('require','exports','fetch',source)((id)=>deps[id]||require(id),mod.exports,async()=>{fetches++;return{ok:true,json:async()=>({error:'Parámetro pag con valor inválido.'})};});
  const oldURL=process.env.GESU_CLIENTES_API_URL,oldToken=process.env.GESU_CLIENTES_API_TOKEN;
  try {
    process.env.GESU_CLIENTES_API_URL='https://example.test/clientes';process.env.GESU_CLIENTES_API_TOKEN='test-only';
    const result=await mod.exports.sincronizarClientesGesu();
    assert.equal(result.nextPage,1);assert.equal(result.skipped,true);assert.equal(fetches,1);assert.equal(reset,true);
  } finally {
    if(oldURL===undefined)delete process.env.GESU_CLIENTES_API_URL;else process.env.GESU_CLIENTES_API_URL=oldURL;
    if(oldToken===undefined)delete process.env.GESU_CLIENTES_API_TOKEN;else process.env.GESU_CLIENTES_API_TOKEN=oldToken;
  }
});
