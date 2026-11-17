const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { Client } = require('pg');

// Ejecuta SQL real dentro de una transaccion que siempre se revierte.
function loadRepository(db, name='cotizaciones-cliente') {
  const file = path.resolve(__dirname,`../src/lib/repos/${name}.ts`);
  const source = ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  const mod = {exports:{}};
  class AppError extends Error { constructor(message,status){super(message);this.status=status;} }
  const deps = {
    '@/lib/db-utils': {query: db.query.bind(db), withTransaction: async (fn)=>{
      if(name==='cotizaciones-cliente') return fn(db);
      await db.query('SAVEPOINT test_cliente');
      try {const result=await fn(db);await db.query('RELEASE SAVEPOINT test_cliente');return result;}
      catch(error){await db.query('ROLLBACK TO SAVEPOINT test_cliente');throw error;}
    }},
    'next/cache': {revalidatePath:()=>{}},
    '@/lib/api-errors': {AppError},
    '@/lib/descuentos-cliente':require('../src/lib/descuentos-cliente.ts'),
  };
  new Function('require','module','exports',source)((id)=>deps[id]||require(id),mod,mod.exports);
  return mod.exports;
}

test('cotiza listas, reglas, kits, errores y snapshots con PostgreSQL', {skip:process.env.IMC_COTIZACION_DB_TEST!=='1'}, async (t) => {
  require('dotenv').config({path:'.env.local',quiet:true});
  const url=process.env.DATABASE_URL;
  const db=new Client(url?{connectionString:url,ssl:url.includes('localhost')?false:{rejectUnauthorized:false}}:{host:process.env.DB_HOST,port:Number(process.env.DB_PORT||5432),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME,ssl:{rejectUnauthorized:false}});
  await db.connect();
  try {
    await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
    const {cotizarCliente,cotizacionClienteSchema}=loadRepository(db);
    const stamp=crypto.randomUUID().slice(0,8).toUpperCase();
    const prices=await db.query("SELECT id,descripcion FROM public.tipo_precio WHERE UPPER(BTRIM(descripcion)) IN ('MOSTRADOR','MECANICO') ORDER BY id");
    const mostrador=prices.rows.find(p=>p.descripcion.trim().toUpperCase()==='MOSTRADOR').id;
    const mecanico=prices.rows.find(p=>p.descripcion.trim().toUpperCase()==='MECANICO').id;
    const doc=String(90000000+Math.floor(Math.random()*9999999));
    const cliente=(await db.query("INSERT INTO public.clientes (razon_social,tipo_documento,documento,bonificacion_general) VALUES ($1,'DNI',$2,10) RETURNING id",['TEST '+stamp,doc])).rows[0].id;
    const marca=(await db.query("INSERT INTO public.marcas (descripcion) VALUES ($1) RETURNING id",['TEST '+stamp])).rows[0].id;
    const categoria=(await db.query("INSERT INTO public.categoria (descripcion) VALUES ($1) RETURNING id",['TEST '+stamp])).rows[0].id;
    const sub=(await db.query("INSERT INTO public.subcategoria (descripcion,id_categoria) VALUES ($1,$2) RETURNING id",['TEST '+stamp,categoria])).rows[0].id;
    const codigo='TEST-COT-'+stamp;
    const producto=(await db.query("INSERT INTO public.productos (cod_unico,descripcion,stock,id_marca,id_subcategoria) VALUES ($1,'Test',4,$2,$3) RETURNING id",[codigo,marca,sub])).rows[0].id;
    await db.query('INSERT INTO public.producto_precio (id_producto,id_tipo_precio,precio) VALUES ($1,$2,100),($1,$3,80)',[producto,mostrador,mecanico]);
    const input=()=>cotizacionClienteSchema.parse({tipoDocumento:'DNI',numeroDocumento:doc,items:[{codigo,cantidad:2}]});
    await t.test('guarda reglas normalizadas, mantiene API anterior y audita sin perder reglas',async()=>{
      const {createCliente,updateCliente,getClienteById}=loadRepository(db,'clientes');
      const payload={razon_social:'Test reglas '+stamp,bonificacion_general:2,reglas_descuento:[{id_marca:marca,descuento:3},{id_subcategoria:sub,descuento:5}]};
      const saved=await createCliente(payload);
      assert.equal(saved.reglas_descuento.length,2);
      assert.equal(saved.reglas_descuento.find(r=>r.id_subcategoria===sub).id_categoria,categoria);
      assert.equal(saved.descuentos_marca[0].descuento,3);
      await updateCliente(saved.id,{razon_social:saved.razon_social,descuentos_marca:[{id_marca:marca,descuento:7}]});
      const legacy=await getClienteById(saved.id);
      assert.equal(legacy.reglas_descuento.length,2);
      assert.equal(legacy.descuentos_marca[0].descuento,7);
      await assert.rejects(()=>updateCliente(saved.id,{...payload,razon_social:'No debe guardarse',reglas_descuento:[{id_subcategoria:sub,descuento:5},{id_categoria:categoria,id_subcategoria:sub,descuento:6}]}),/mismo alcance/);
      assert.equal((await getClienteById(saved.id)).razon_social,saved.razon_social);
      assert.equal((await db.query('SELECT COUNT(*)::int n FROM public.cliente_condiciones_historial WHERE id_cliente=$1',[saved.id])).rows[0].n,2);
    });
    let original;
    await t.test('MOSTRADOR predeterminada, sin exponer condiciones privadas',async()=>{
      original=await cotizarCliente(input());
      assert.equal(original.items[0].precioUnitarioFinal,90);
      assert.equal(original.ivaIncluido,true);
      assert.equal(original.items[0].encontrado,true);
      assert.equal(original.total,180);
      assert.equal(original.puedeConfirmar,true);
      assert.equal(original.stockReservado,false);
      for(const key of ['descuento','regla','lista','bonificacion','precioLista']) assert.equal(JSON.stringify(original).includes('"'+key+'"'),false);
    });
    await t.test('lista asignada y regla especifica reemplazan bonificacion',async()=>{
      await db.query('UPDATE public.clientes SET id_tipo_precio=$1 WHERE id=$2',[mecanico,cliente]);
      await db.query('INSERT INTO public.cliente_regla_descuento(id_cliente,id_marca,descuento) VALUES ($1,$2,20)',[cliente,marca]);
      await db.query('INSERT INTO public.cliente_regla_descuento(id_cliente,id_marca,id_categoria,id_subcategoria,descuento) VALUES ($1,$2,$3,$4,5)',[cliente,marca,categoria,sub]);
      const result=await cotizarCliente(input());
      assert.equal(result.items[0].precioUnitarioFinal,76);
    });
    await t.test('detecta cambio y conserva snapshot original',async()=>{
      const result=await cotizarCliente({...input(),cotizacionAnteriorId:original.cotizacionId});
      assert.equal(result.requiereConfirmarCambios,true);
      assert.equal(result.puedeConfirmar,false);
      assert.deepEqual(result.cambiosPrecio,[codigo]);
      const saved=(await db.query('SELECT respuesta FROM public.partner_cotizacion WHERE id=$1',[original.cotizacionId])).rows[0].respuesta;
      assert.equal(saved.items[0].precioUnitarioFinal,90);
      await assert.rejects(()=>cotizarCliente({...input(),items:[{codigo,cantidad:3}],cotizacionAnteriorId:original.cotizacionId}),/cantidades/);
    });
    await t.test('kit usa su propio alcance y cantidad de componentes',async()=>{
      const kit=(await db.query("INSERT INTO public.kits(codigo_kit,nombre,id_marca,id_categoria,criterio_costo) VALUES ($1,'Test',$2,$3,'COMPONENTES') RETURNING id",[codigo+'-KIT',marca,categoria])).rows[0].id;
      await db.query('INSERT INTO public.kit_detalle(id_kit,id_producto,cantidad) VALUES($1,$2,2)',[kit,producto]);
      const result=await cotizarCliente({...input(),items:[{codigo:codigo+'-KIT',tipo:'KIT',cantidad:1}]});
      assert.equal(result.items[0].precioUnitarioFinal,128);
      assert.equal(result.items[0].stockDisponible,2);
      assert.equal(result.items[0].encontrado,true);
      assert.equal(result.ivaIncluido,true);
      const shared=await cotizarCliente({...input(),items:[{codigo,cantidad:3},{codigo:codigo+'-KIT',tipo:'KIT',cantidad:1}]});
      assert.equal(shared.items[0].stockSuficiente,false);
      assert.equal(shared.items[1].stockSuficiente,false);
      assert.equal(shared.puedeConfirmar,false);
      await db.query('DELETE FROM public.producto_precio WHERE id_producto=$1 AND id_tipo_precio=$2',[producto,mecanico]);
      const incomplete=await cotizarCliente({...input(),items:[{codigo:codigo+'-KIT',tipo:'KIT',cantidad:1}]});
      assert.equal(incomplete.items[0].error,'KIT_INCOMPLETO');
      assert.equal(incomplete.total,null);
      await db.query('INSERT INTO public.producto_precio (id_producto,id_tipo_precio,precio) VALUES ($1,$2,80)',[producto,mecanico]);
    });
    await t.test('stock insuficiente, codigos inexistentes y repetidos',async()=>{
      const result=await cotizarCliente({...input(),items:[{codigo,cantidad:5},{codigo:'INEXISTENTE-'+stamp,cantidad:1}]});
      assert.equal(result.items[0].stockSuficiente,false);
      assert.equal(result.items[0].encontrado,true);
      assert.equal(result.items[0].precioUnitarioFinal,76);
      assert.equal(result.items[1].error,'CODIGO_NO_ENCONTRADO');
      assert.equal(result.items[1].encontrado,false);
      assert.equal(result.items[1].precioUnitarioFinal,null);
      assert.equal(result.items[1].subtotal,null);
      assert.equal(result.total,null);
      await assert.rejects(()=>cotizarCliente({...input(),items:[{codigo,cantidad:1},{codigo,cantidad:1}]}),/repetirse/);
    });
    await t.test('lote mixto conserva precios de item y kit cuando falta un codigo manual',async()=>{
      const result=await cotizarCliente({...input(),items:[{codigo,cantidad:1},{codigo:codigo+'-KIT',tipo:'KIT',cantidad:1},{codigo:'MANUAL-'+stamp,cantidad:1}]});
      assert.deepEqual(result.items.map(r=>r.encontrado),[true,true,false]);
      assert.deepEqual(result.items.map(r=>r.precioUnitarioFinal),[76,128,null]);
      assert.equal(result.ivaIncluido,true);
      assert.equal(result.total,null);
      assert.equal(result.puedeConfirmar,false);
    });
    await t.test('si un codigo desaparece o aparece la comparacion mantiene el lote',async()=>{
      const previous=await cotizarCliente(input());
      await db.query('UPDATE public.productos SET cod_unico=$1 WHERE id=$2',[codigo+'-CAMBIADO',producto]);
      const missing=await cotizarCliente({...input(),cotizacionAnteriorId:previous.cotizacionId});
      assert.equal(missing.items[0].encontrado,false);
      assert.equal(missing.items[0].precioUnitarioFinal,null);
      assert.equal(missing.requiereConfirmarCambios,true);
      await db.query('UPDATE public.productos SET cod_unico=$1 WHERE id=$2',[codigo,producto]);
      const returned=await cotizarCliente({...input(),cotizacionAnteriorId:missing.cotizacionId});
      assert.equal(returned.items[0].encontrado,true);
      assert.equal(returned.items[0].precioUnitarioFinal,76);
      assert.equal(returned.requiereConfirmarCambios,true);
    });
    await t.test('documento duplicado no elige un cliente al azar',async()=>{
      await db.query("INSERT INTO public.clientes(razon_social,tipo_documento,documento) VALUES($1,'DNI',$2)",['Test duplicado '+stamp,doc]);
      await assert.rejects(()=>cotizarCliente(input()),/mas de un cliente/);
    });
  } finally {await db.query('ROLLBACK');await db.end();}
});
