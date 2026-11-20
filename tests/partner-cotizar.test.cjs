const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { NextRequest } = require('next/server');

function load(file, overrides) {
  const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  const mod={exports:{}};
  new Function('require','module','exports',source)((id)=>overrides[id]||require(id),mod,mod.exports);
  return mod.exports;
}
class AppError extends Error {constructor(message,status){super(message);this.status=status;}}
const repository=load('src/lib/repos/cotizaciones-cliente.ts',{
  '@/lib/api-errors':{AppError}, '@/lib/db-utils':{},
  '@/lib/descuentos-cliente':require('../src/lib/descuentos-cliente.ts'),
});

test('API de cotizacion autentica, valida y recupera respuestas sin cache',async(t)=>{
  const prior=process.env.PARTNER_CATALOG_API_KEY;
  const secret='clave-de-prueba-aislada';
  const id=crypto.randomUUID();
  const saved={cotizacionId:id,items:[{codigo:'ABC',precioUnitarioFinal:100}]};
  const route=load('src/app/api/partner/cotizar/route.ts',{
    '@/lib/api-errors':{AppError},
    '@/lib/db-utils':{query:async()=>({rowCount:1,rows:[{respuesta:saved}]})},
    '@/lib/repos/cotizaciones-cliente':{cotizacionClienteSchema:repository.cotizacionClienteSchema,cotizarCliente:async()=>saved},
  });
  const payload={tipoDocumento:'DNI',numeroDocumento:'12345678',items:[{codigo:'ABC',cantidad:1}]};
  const post=(body,auth=secret)=>route.POST(new NextRequest('http://localhost/api/partner/cotizar',{method:'POST',headers:{'content-type':'application/json',...(auth?{'x-api-key':auth}:{})},body:typeof body==='string'?body:JSON.stringify(body)}));
  try {
    process.env.PARTNER_CATALOG_API_KEY=secret;
    await t.test('requiere clave correcta antes de procesar el cuerpo',async()=>{
      assert.equal((await post(payload,null)).status,401);
      assert.equal((await post(payload,'otra-clave')).status,401);
      assert.equal((await post(payload,'x'.repeat(secret.length))).status,401);
    });
    await t.test('JSON, documentos, cantidades y limites invalidos producen 400',async()=>{
      for(const value of ['{', {...payload,numeroDocumento:'ABC12345678'}, {...payload,clienteId:0}, {...payload,items:[{codigo:'ABC',cantidad:-1}]}, {...payload,items:[]}, {...payload,items:Array.from({length:101},()=>payload.items[0])}]) assert.equal((await post(value)).status,400);
    });
    await t.test('acepta ID, razon social y documento sin tipo',async()=>{
      for(const identity of [{clienteId:2685,tipoDocumento:null,numeroDocumento:null},{razonSocial:'INYECAR'},{numeroDocumento:'20432932355'},{}]) {
        assert.equal((await post({...identity,items:payload.items})).status,200);
      }
    });
    await t.test('respuesta autenticada y snapshot original no usan cache',async()=>{
      const response=await post(payload);
      assert.equal(response.status,200);
      assert.equal(response.headers.get('cache-control'),'private, no-store');
      assert.deepEqual(await response.json(),saved);
      const original=await route.GET(new NextRequest(`http://localhost/api/partner/cotizar?id=${id}`,{headers:{'x-api-key':secret}}));
      assert.equal(original.status,200);
      assert.deepEqual(await original.json(),saved);
    });
    await t.test('sin configuracion devuelve 503',async()=>{
      delete process.env.PARTNER_CATALOG_API_KEY;
      assert.equal((await post(payload)).status,503);
    });
  } finally {if(prior===undefined)delete process.env.PARTNER_CATALOG_API_KEY;else process.env.PARTNER_CATALOG_API_KEY=prior;}
});
