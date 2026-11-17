const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const {periodoEstadisticasVentas,fechaArgentina,fechasPeriodoVentas}=require('../src/lib/periodo-estadisticas-ventas.ts');

test('usa dias argentinos y compara el mismo horario del periodo anterior',()=>{
  const p=periodoEstadisticasVentas(7,new Date('2026-11-18T01:30:00Z'));
  assert.equal(p.desde.toISOString(),'2026-11-11T03:00:00.000Z');
  assert.equal(p.hastaAnterior.toISOString(),'2026-11-11T01:30:00.000Z');
  assert.equal(p.desdeAnterior.toISOString(),'2026-11-04T03:00:00.000Z');
  assert.equal(p.hasta-p.desde,p.hastaAnterior-p.desdeAnterior);
  assert.equal(fechaArgentina(p.hasta),'2026-11-17');
  assert.equal(fechasPeriodoVentas(p.desde,7).at(-1),'2026-11-17');
});
test('hoy comienza a medianoche argentina y rellena fechas sin ventas',()=>{
  const p=periodoEstadisticasVentas(1,new Date('2026-11-17T17:00:00Z'));
  assert.equal(p.desde.toISOString(),'2026-11-17T03:00:00.000Z');
  assert.deepEqual(fechasPeriodoVentas(p.desde,p.dias),['2026-11-17']);
});

test('ejecuta todas las consultas de estadisticas ML en PostgreSQL sin huecos de parametros',{skip:process.env.IMC_ESTADISTICAS_DB_TEST!=='1'},async()=>{
  require('dotenv').config({path:'.env.local',quiet:true});
  const {Client}=require('pg');const u=process.env.DATABASE_URL;
  const db=new Client(u?{connectionString:u,ssl:u.includes('localhost')?false:{rejectUnauthorized:false}}:{host:process.env.DB_HOST,port:Number(process.env.DB_PORT||5432),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME,ssl:{rejectUnauthorized:false}});
  await db.connect();
  try {
    await db.query('BEGIN READ ONLY');
    const text=fs.readFileSync('src/lib/mercadolibre.ts','utf8');
    const start=text.indexOf('export async function getMercadoLibreEstadisticas(');
    const end=text.indexOf('\nasync function getMercadoLibreEstadisticasLegado',start);
    assert.ok(start>=0&&end>start);
    const js=ts.transpileModule(text.slice(start,end),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
    const mod={exports:{}};let executed=0;
    new Function('exports','query','periodoEstadisticasVentas','fechasPeriodoVentas','visitasMercadoLibre','secureThumbnailUrl',js)(mod.exports,async(sql,params)=>{
      executed++;
      const nums=[...sql.matchAll(/\$(\d+)/g)].map(m=>Number(m[1]));
      assert.equal(Math.max(...nums),params.length);
      assert.equal(new Set(nums).size,params.length);
      return db.query(sql,params);
    },periodoEstadisticasVentas,fechasPeriodoVentas,async()=>0,()=>null);
    for(const dias of [1,7,30,365]) {
      const r=await mod.exports.getMercadoLibreEstadisticas(2147483647,dias,new Date('2026-11-17T18:00:00Z'));
      assert.equal(r.metricas.ventasBrutas.actual,0);
      assert.equal(r.evolucion.length,dias);
      assert.equal(r.evolucion.at(-1).fecha,'2026-11-17');
      assert.deepEqual(r.productos,[]);
    }
    assert.equal(executed,12);
  } finally {await db.query('ROLLBACK');await db.end();}
});
