const assert = require("node:assert/strict");
const test = require("node:test");
const { Client } = require("pg");

const url = process.env.TEST_DATABASE_URL;
const run = url ? test : test.skip;

run("GESU staging rejects incomplete sessions without changing catalog data", async () => {
  const db = new Client({ connectionString: url, ssl: false });
  await db.connect();
  try {
    await db.query("TRUNCATE public.gesu_importacion CASCADE");
    await db.query("INSERT INTO public.usuario (id) VALUES (1) ON CONFLICT DO NOTHING");
    const originalCount = Number((await db.query("SELECT COUNT(*)::int AS count FROM public.productos")).rows[0].count);
    const { iniciarImportacionGesu, guardarLoteGesu, aplicarImportacionGesu } = await import("../src/lib/repos/importacion-gesu.ts");
    const id = crypto.randomUUID();
    await iniciarImportacionGesu(id, 1, "gesu.xlsx", 2);
    await guardarLoteGesu(id, 1, 0, "productos", [{ "Codigo Unico": "NUEVO", Descripcion: "Nuevo" }]);
    await assert.rejects(() => aplicarImportacionGesu(id, 1, "Prueba"), /Faltan lotes/);
    const state = await db.query("SELECT resultado FROM public.gesu_importacion WHERE id = $1", [id]);
    assert.equal(state.rows[0].resultado, null);
    assert.equal(Number((await db.query("SELECT COUNT(*)::int AS count FROM public.productos")).rows[0].count), originalCount);
  } finally { await db.end(); }
});

run("converted originals are deleted only when the review has no conflicts", async () => {
  const db = new Client({ connectionString: url, ssl: false });
  await db.connect();
  try {
    await db.query("TRUNCATE public.kit_detalle, public.kits, public.producto_actividad, public.producto_stock_ubicacion, public.producto_proveedor, public.producto_precio, public.productos CASCADE");
    await db.query("INSERT INTO public.usuario (id) VALUES (1) ON CONFLICT DO NOTHING");
    await db.query("INSERT INTO public.productos (id, cod_unico, descripcion, stock, oculto_por_kit) VALUES (1, 'GRUPO-OK', 'Original eliminable', 0, true), (2, 'COMPONENTE', 'Componente', 0, false), (3, 'GRUPO-STOCK', 'Original con stock', 3, true)");
    await db.query("INSERT INTO public.kits (id, codigo_kit, nombre, activo) VALUES (10, 'GRUPO-OK', 'Kit OK', true), (11, 'GRUPO-STOCK', 'Kit bloqueado', true)");
    await db.query("INSERT INTO public.kit_detalle (id_kit, id_producto, cantidad) VALUES (10, 2, 2), (11, 2, 1)");
    const { eliminarOriginalesConvertidos } = await import("../src/lib/repos/conversion-kits.ts");
    const { withTransaction } = await import("../src/lib/db-utils.ts");
    assert.deepEqual(await withTransaction((client) => eliminarOriginalesConvertidos(client, ["GRUPO-OK"], 1)), ["GRUPO-OK"]);
    assert.equal((await db.query("SELECT COUNT(*)::int AS count FROM public.productos WHERE id = 1")).rows[0].count, 0);
    const audit = await db.query("SELECT id_producto, datos->'producto'->>'cod_unico' AS code FROM public.producto_actividad WHERE codigo_producto = 'GRUPO-OK'");
    assert.deepEqual(audit.rows, [{ id_producto: null, code: "GRUPO-OK" }]);
    await assert.rejects(
      () => withTransaction((client) => eliminarOriginalesConvertidos(client, ["GRUPO-STOCK"], 1)),
      /Tiene stock propio/
    );
    assert.equal((await db.query("SELECT COUNT(*)::int AS count FROM public.productos WHERE id = 3")).rows[0].count, 1);
  } finally { await db.end(); }
});

run("a conversion conflict rolls back new items and the kit together", async () => {
  const db = new Client({ connectionString: url, ssl: false });
  await db.connect();
  try {
    await db.query("TRUNCATE public.gesu_importacion CASCADE");
    await db.query("TRUNCATE public.kit_detalle, public.kits, public.producto_actividad, public.producto_stock_ubicacion, public.producto_proveedor, public.producto_precio, public.productos CASCADE");
    await db.query("INSERT INTO public.usuario (id) VALUES (1) ON CONFLICT DO NOTHING");
    await db.query("INSERT INTO public.productos (id, cod_unico, descripcion, stock, oculto_por_kit) VALUES (90, 'GRUPO-CON-STOCK', 'Original bloqueado', 2, false)");
    const { iniciarImportacionGesu, guardarLoteGesu, aplicarImportacionGesu } = await import("../src/lib/repos/importacion-gesu.ts");
    const id = crypto.randomUUID();
    await iniciarImportacionGesu(id, 1, "grupo.xlsx", 2);
    await guardarLoteGesu(id, 1, 0, "productos", [
      { "Codigo Unico": "COMP-A", Descripcion: "Componente A", Stock: 0 },
      { "Codigo Unico": "COMP-B", Descripcion: "Componente B", Stock: 0 },
    ]);
    await guardarLoteGesu(id, 1, 1, "kits", [
      { "Codigo Kit": "GRUPO-CON-STOCK", "Nombre Kit": "Kit bloqueado", "Codigo Item": "COMP-A", Cantidad: 1 },
      { "Codigo Kit": "GRUPO-CON-STOCK", "Nombre Kit": "Kit bloqueado", "Codigo Item": "COMP-B", Cantidad: 2 },
    ]);
    await assert.rejects(() => aplicarImportacionGesu(id, 1, "Prueba"), /Tiene stock propio/);
    assert.equal((await db.query("SELECT COUNT(*)::int AS count FROM public.productos WHERE cod_unico IN ('COMP-A', 'COMP-B')")).rows[0].count, 0);
    assert.equal((await db.query("SELECT COUNT(*)::int AS count FROM public.kits WHERE codigo_kit = 'GRUPO-CON-STOCK'")).rows[0].count, 0);
    assert.equal((await db.query("SELECT COUNT(*)::int AS count FROM public.productos WHERE id = 90")).rows[0].count, 1);
  } finally { await db.end(); }
});

run("kit quantities require a positive safe integer", async () => {
  const { cantidadComponenteKitValida } = await import("../src/lib/kit-cantidades.ts");
  for (const value of [1, "1", "02", "4,0", "8.000"]) assert.ok(cantidadComponenteKitValida(value));
  for (const value of ["", 0, -1, "1.5", "2,3", "x", Number.MAX_SAFE_INTEGER + 1]) assert.equal(cantidadComponenteKitValida(value), null);
});
