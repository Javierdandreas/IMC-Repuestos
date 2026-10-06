const assert = require("node:assert/strict");
const test = require("node:test");
const { Client } = require("pg");
const { condicionBusquedaKit, condicionBusquedaProducto, parametroBusquedaItems } = require("../src/lib/busqueda-items.ts");

test("search parameters preserve codes and escape LIKE wildcards", () => {
  assert.equal(parametroBusquedaItems(" 0899008O "), "%0899008O%");
  assert.equal(parametroBusquedaItems(" 001_a%\\b "), "%001\\_a\\%\\\\b%");
  assert.equal(parametroBusquedaItems(" 001_a%\\b ", true), "001_a%\\b");
});

test("search SQL never embeds user input", () => {
  assert.match(condicionBusquedaProducto(3), /ILIKE \$3/);
  assert.match(condicionBusquedaProducto(4, true), /UPPER\(\$4::text\)/);
  assert.match(condicionBusquedaKit(2), /componente\.cod_unico/);
});

// Only use a disposable local database. No application credentials are loaded.
test("catalog search against PostgreSQL", { skip: !process.env.TEST_DATABASE_URL }, async (t) => {
  const url = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname));
  assert.equal(url.pathname, "/imc_search_test");
  const db = new Client({ connectionString: url.toString(), ssl: false });
  await db.connect();
  try {
    await db.query("BEGIN");
    await db.query(`
      CREATE TABLE public.productos (
        id int PRIMARY KEY, cod_unico text, cod_barra text, descripcion text, palabra_clave text,
        id_pieza int, id_marca int, id_subcategoria int, id_ubicacion int, oculto_por_kit boolean
      );
      CREATE TABLE public.pieza (id int, codigo_pieza int, descripcion text, medida text);
      CREATE TABLE public.proveedores (id int, descripcion text);
      CREATE TABLE public.producto_proveedor (id_producto int, id_proveedor int, codigo_proveedor text);
      CREATE TABLE public.codigo_referencia (id int, codigo text);
      CREATE TABLE public.pieza_codigo_referencia (id_pieza int, id_codigo_referencia int, tipo text, observacion text);
      CREATE TABLE public.marcas (id int, descripcion text);
      CREATE TABLE public.categoria (id int, descripcion text);
      CREATE TABLE public.subcategoria (id int, id_categoria int, descripcion text);
      CREATE TABLE public.ubicaciones (id int, descripcion text);
      CREATE TABLE public.producto_stock_ubicacion (id_producto int, id_ubicacion int, cantidad int);
      CREATE TABLE public.producto_serie (id_producto int, numero_serie text, id_ubicacion int);
      CREATE TABLE public.kits (id int, codigo_kit text, nombre text, descripcion text, id_categoria int, id_subcategoria int);
      CREATE TABLE public.kit_detalle (id_kit int, id_producto int);

      INSERT INTO public.productos VALUES
        (1, '001MANN', '000123456', 'Filtro especial', 'camioneta', 10, 20, 30, 40, false),
        (2, 'SEGUNDO', NULL, 'Otro repuesto', NULL, NULL, NULL, NULL, NULL, false),
        (3, 'OCULTO', NULL, 'Registro oculto', NULL, NULL, NULL, NULL, NULL, true),
        (4, '001_a%', NULL, 'Codigo literal', NULL, NULL, NULL, NULL, NULL, false),
        (5, '001XaZ', NULL, 'No es literal', NULL, NULL, NULL, NULL, NULL, false);
      INSERT INTO public.pieza VALUES (10, 9876, 'Pieza asociada', '27mm');
      INSERT INTO public.proveedores VALUES (50, 'EXPOYER'), (51, 'DER');
      INSERT INTO public.producto_proveedor VALUES (1, 50, '0899008O'), (1, 51, 'DER-002');
      INSERT INTO public.codigo_referencia VALUES (60, 'OEM-001'), (61, 'EQUIV-002'), (62, 'SUST-003');
      INSERT INTO public.pieza_codigo_referencia VALUES
        (10, 60, 'ORIGINAL', 'motor diesel'), (10, 61, 'EQUIVALENTE', NULL), (10, 62, 'SUSTITUTO', NULL);
      INSERT INTO public.marcas VALUES (20, 'MANN FILTER');
      INSERT INTO public.categoria VALUES (31, 'Mantenimiento'), (32, 'Combos');
      INSERT INTO public.subcategoria VALUES (30, 31, 'Filtracion'), (33, 32, 'Servicios');
      INSERT INTO public.ubicaciones VALUES (40, 'A20-8'), (41, 'B30-4'), (42, 'C40-2');
      INSERT INTO public.producto_stock_ubicacion VALUES (1, 41, 3);
      INSERT INTO public.producto_serie VALUES (1, 'SERIE-0009', 42);
      INSERT INTO public.kits VALUES (70, 'KIT-001', 'Service completo', 'Combo motor', 32, 33),
        (71, 'KIT-OCULTO', 'Kit oculto', '', NULL, NULL);
      INSERT INTO public.kit_detalle VALUES (70, 1), (70, 2), (71, 3);
    `);

    const findProducts = async (value, exact = false) => {
      const result = await db.query(`SELECT p.id FROM public.productos p
        WHERE NOT COALESCE(p.oculto_por_kit, false) AND ${condicionBusquedaProducto(1, exact)} ORDER BY p.id`,
      [parametroBusquedaItems(value, exact)]);
      return result.rows.map((row) => row.id);
    };
    const findKits = async (value, exact = false) => {
      const result = await db.query(`SELECT k.id FROM public.kits k WHERE ${condicionBusquedaKit(1, exact)} ORDER BY k.id`,
        [parametroBusquedaItems(value, exact)]);
      return result.rows.map((row) => row.id);
    };

    for (const value of ["001mann", "000123456", "especial", "camioneta", "9876", "asociada", "27mm",
      "0899008o", "der-002", "expoyer", "oem-001", "equiv-002", "sust-003", "diesel", "filter",
      "mantenimiento", "filtracion", "a20-8", "b30-4", "c40-2", "serie-0009"]) {
      await t.test(`general search: ${value}`, async () => {
        assert.deepEqual(await findProducts(value), [1]);
        assert.deepEqual(await findKits(value), [70]);
      });
    }
    for (const value of [" 001mann ", "000123456", "9876", "0899008o", "der-002", "oem-001", "equiv-002", "sust-003", "serie-0009"]) {
      await t.test(`exact search: ${value}`, async () => {
        assert.deepEqual(await findProducts(value, true), [1]);
        assert.deepEqual(await findKits(value, true), [70]);
      });
    }
    await t.test("exact codes do not match descriptions, substrings, or confuse O with zero", async () => {
      for (const value of ["especial", "camioneta", "expoyer", "08990080", "899008O", "001", "987"]) {
        assert.deepEqual(await findProducts(value, true), []);
      }
    });
    await t.test("kits match their names, descriptions and classification", async () => {
      for (const value of ["kit-001", "service", "combo motor", "combos", "servicios"]) {
        assert.deepEqual(await findKits(value), [70]);
      }
      assert.deepEqual(await findKits(" kit-001 ", true), [70]);
      assert.deepEqual(await findKits("kit-00", true), []);
    });
    await t.test("hidden products cannot match as kit components", async () => {
      assert.deepEqual(await findProducts("registro oculto"), []);
      assert.deepEqual(await findKits("registro oculto"), []);
    });
    await t.test("wildcards and quotes are literal search text", async () => {
      assert.deepEqual(await findProducts("001_a%"), [4]);
      assert.deepEqual(await findProducts("001_a%", true), [4]);
      assert.deepEqual(await findProducts("' OR TRUE --"), []);
      assert.deepEqual(await findProducts("\\"), []);
    });
    await t.test("supplier matches retain all suppliers and reference matches retain all references", async () => {
      for (const value of ["0899008O", "OEM-001"]) {
        const result = await db.query(`SELECT p.id,
          ARRAY_AGG(DISTINCT pp.codigo_proveedor ORDER BY pp.codigo_proveedor) AS suppliers,
          ARRAY_AGG(DISTINCT cr.codigo ORDER BY cr.codigo) AS refs
          FROM public.productos p
          LEFT JOIN public.producto_proveedor pp ON pp.id_producto = p.id
          LEFT JOIN public.pieza_codigo_referencia pcr ON pcr.id_pieza = p.id_pieza
          LEFT JOIN public.codigo_referencia cr ON cr.id = pcr.id_codigo_referencia
          WHERE ${condicionBusquedaProducto(1)} GROUP BY p.id`, [parametroBusquedaItems(value)]);
        assert.equal(result.rows.length, 1);
        assert.deepEqual(result.rows[0].suppliers, ["0899008O", "DER-002"]);
        assert.deepEqual(result.rows[0].refs, ["EQUIV-002", "OEM-001", "SUST-003"]);
      }
    });
    await t.test("search composes with filters, counts and pagination", async () => {
      const sql = `SELECT p.id FROM public.productos p WHERE p.id_marca = $1 AND ${condicionBusquedaProducto(2)}`;
      const params = [20, parametroBusquedaItems("OEM")];
      const count = await db.query(`SELECT COUNT(*)::int AS count FROM (${sql}) results`, params);
      assert.equal(count.rows[0].count, 1);
      const page = await db.query(`${sql} ORDER BY p.id LIMIT $3 OFFSET $4`, [...params, 1, 0]);
      assert.deepEqual(page.rows, [{ id: 1 }]);
      const emptyPage = await db.query(`${sql} ORDER BY p.id LIMIT $3 OFFSET $4`, [...params, 1, 1]);
      assert.deepEqual(emptyPage.rows, []);
      const filtered = await db.query(sql, [99, params[1]]);
      assert.deepEqual(filtered.rows, []);
    });
  } finally {
    await db.query("ROLLBACK");
    await db.end();
  }
});
