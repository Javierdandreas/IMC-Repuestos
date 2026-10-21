const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const { Client } = require("pg");

const url = process.env.TEST_DATABASE_URL;
const run = url ? test : test.skip;

function statementsFor(name, nextName) {
  const source = fs.readFileSync("src/lib/repos/proveedor-importaciones.ts", "utf8");
  const start = source.indexOf(`async function ${name}(`);
  const end = source.indexOf(`async function ${nextName}(`, start);
  assert.ok(start >= 0 && end > start);
  return [...source.slice(start, end).matchAll(/`([^`]*)`/gs)].map((match) => match[1].replaceAll("public.", "pg_temp."));
}

run("conserva codigos por proveedor y resuelve duplicados sin perder precios anteriores", async () => {
  const db = new Client({ connectionString: url });
  await db.connect();
  try {
    await db.query(`
      CREATE TEMP TABLE proveedores (id integer PRIMARY KEY);
      CREATE TEMP TABLE proveedor_importacion (id integer PRIMARY KEY, id_proveedor integer, estado text, created_at timestamptz, observacion text, updated_at timestamptz);
      CREATE TEMP TABLE proveedor_importacion_item (id integer PRIMARY KEY, id_importacion integer, fila integer, codigo_proveedor text, precio_lista numeric, precio_origen numeric, stock_original text, stock_estado text, stock_cantidad numeric, estado text, mensaje text, id_producto integer, precio_anterior numeric, precio_aplicado numeric, applied_at timestamptz);
      CREATE TEMP TABLE producto_proveedor (id_producto integer, id_proveedor integer, codigo_proveedor text, precio_lista_actual numeric);
      INSERT INTO proveedores VALUES (1), (2);
      INSERT INTO proveedor_importacion (id,id_proveedor,estado,created_at) VALUES (1,1,'PROCESADA','2026-01-01'), (2,1,'PROCESADA','2026-01-02'), (3,2,'PROCESADA','2026-01-03');
      INSERT INTO proveedor_importacion_item (id,id_importacion,fila,codigo_proveedor,precio_lista,stock_original,stock_estado,stock_cantidad,estado) VALUES
        (1,1,1,'A',10,'DISPONIBLE','DISPONIBLE',NULL,'PENDIENTE'),
        (2,1,2,'C',30,'DISPONIBLE','DISPONIBLE',NULL,'PENDIENTE'),
        (3,1,3,' c ',30,'SIN STOCK','SIN_STOCK',0,'PENDIENTE'),
        (4,1,4,'D',40,'DISPONIBLE','DISPONIBLE',NULL,'PENDIENTE'),
        (5,1,5,'D',41,'DISPONIBLE','DISPONIBLE',NULL,'PENDIENTE'),
        (6,2,1,'a',20,'SIN STOCK','SIN_STOCK',0,'PENDIENTE'),
        (7,2,2,'B',50,'DISPONIBLE','DISPONIBLE',NULL,'PENDIENTE'),
        (8,3,1,'A',99,'DISPONIBLE','DISPONIBLE',NULL,'PENDIENTE');
    `);
    const migration = fs.readFileSync("database/70-proveedor-catalogo-acumulado.sql", "utf8").replaceAll("public.", "pg_temp.");
    await db.query(migration);
    const prepare = statementsFor("prepararImportacionParaAplicar", "resumenAplicacionImportacion");
    const finalize = statementsFor("finalizarAplicacionImportacion", "aplicarImportacionAlCatalogoCompletaLegacy");
    assert.equal(prepare.length, 6);
    assert.equal(finalize.length, 2);
    const apply = async (id) => {
      for (const sql of prepare.slice(2)) await db.query(sql, [id]);
      for (const sql of finalize) await db.query(sql, [id]);
    };
    await apply(1);
    const first = (await db.query("SELECT codigo_normalizado, precio_lista::float, stock_estado FROM proveedor_catalogo_precio ORDER BY codigo_normalizado")).rows;
    assert.deepEqual(first, [{ codigo_normalizado: "A", precio_lista: 10, stock_estado: "DISPONIBLE" }, { codigo_normalizado: "C", precio_lista: 30, stock_estado: "DESCONOCIDO" }]);
    await apply(2);
    await apply(3);
    await db.query(finalize[1], [1]);
    await db.query("DELETE FROM proveedor_importacion_item WHERE id_importacion = 1");
    const rows = (await db.query("SELECT id_proveedor, codigo_normalizado, precio_lista::float, stock_estado FROM proveedor_catalogo_precio ORDER BY id_proveedor, codigo_normalizado")).rows;
    assert.deepEqual(rows, [
      { id_proveedor: 1, codigo_normalizado: "A", precio_lista: 20, stock_estado: "SIN_STOCK" },
      { id_proveedor: 1, codigo_normalizado: "B", precio_lista: 50, stock_estado: "DISPONIBLE" },
      { id_proveedor: 1, codigo_normalizado: "C", precio_lista: 30, stock_estado: "DESCONOCIDO" },
      { id_proveedor: 2, codigo_normalizado: "A", precio_lista: 99, stock_estado: "DISPONIBLE" },
    ]);
  } finally {
    await db.end();
  }
});
