const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

class AppError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

function loadRepository(db) {
  const source = ts.transpileModule(fs.readFileSync('src/lib/repos/cotizaciones-cliente.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', source)((id) => {
    if (id === '@/lib/db-utils') return { withTransaction: (fn) => fn(db) };
    if (id === '@/lib/api-errors') return { AppError };
    if (id === '@/lib/descuentos-cliente') return require('../src/lib/descuentos-cliente.ts');
    return require(id);
  }, mod, mod.exports);
  return mod.exports;
}

function fixture(clients) {
  const calls = [];
  const saved = new Map();
  const prices = { mostrador: 100, mecanico: 80 };
  const rows = (matches) => ({ rows: matches.slice(0, 2), rowCount: Math.min(matches.length, 2) });
  const db = { async query(sql, params = []) {
    if (sql.startsWith('SET TRANSACTION')) return rows([]);
    if (sql.includes('FROM public.clientes')) {
      let matches;
      if (sql.includes('AND id=$1')) {
        calls.push('id');
        matches = clients.filter((c) => c.id === params[0]);
      } else if (sql.includes('UPPER(BTRIM(COALESCE(tipo_documento')) {
        calls.push('documentoConTipo');
        matches = clients.filter((c) => c.tipo_documento === params[0] && c.documento?.replace(/\D/g, '') === params[1]);
      } else if (sql.includes('REGEXP_REPLACE')) {
        calls.push('documento');
        matches = clients.filter((c) => c.documento?.replace(/\D/g, '') === params[0]);
      } else {
        calls.push('razonSocial');
        matches = clients.filter((c) => c.razon_social.trim().toUpperCase() === params[0].trim().toUpperCase());
      }
      return rows(matches.filter((c) => c.activo !== false));
    }
    if (sql.includes('FROM public.tipo_precio')) return rows([{ id: params[0] ?? 1 }]);
    if (sql.includes('FROM public.cliente_regla_descuento')) return rows([]);
    if (sql.includes('FROM public.productos p') && sql.includes('UNION ALL')) {
      return rows([{ tipo: 'ITEM', id: 10, codigo: 'ABC', descripcion: 'Repuesto', id_marca: null,
        id_categoria: null, id_subcategoria: null, activo: true,
        precio: String(params[1] === 2 ? prices.mecanico : prices.mostrador), stock: 5,
        completo: true, consumos: [{ id: 10, cantidad: 1, stock: 5 }] }]);
    }
    if (sql.includes('FROM public.partner_cotizacion')) {
      const previous = saved.get(params[0]);
      return rows(previous && previous.clienteId === params[1]
        ? [{ respuesta: previous.respuesta, solicitud: previous.solicitud }] : []);
    }
    if (sql.includes('INSERT INTO public.partner_cotizacion')) {
      const [id, clienteId, , respuesta, internals] = params;
      saved.set(id, { clienteId, respuesta: JSON.parse(respuesta), solicitud: JSON.parse(internals).solicitud });
      return rows([]);
    }
    throw new Error(`Consulta inesperada: ${sql.slice(0, 100)}`);
  } };
  const repo = loadRepository(db);
  const quote = (identity = {}) => repo.cotizarCliente(repo.cotizacionClienteSchema.parse({
    ...identity, items: [{ codigo: 'ABC', tipo: 'ITEM', cantidad: 2 }],
  }));
  return { calls, saved, prices, quote };
}

test('clienteId tiene prioridad aunque falten documentos', async () => {
  const f = fixture([{ id: 2685, razon_social: 'INYECAR', documento: null, tipo_documento: null,
    id_tipo_precio: 2, bonificacion_general: '10' }]);
  const result = await f.quote({ clienteId: 2685, numeroDocumento: '20432932355', razonSocial: 'OTRO' });
  assert.deepEqual(f.calls, ['id']);
  assert.equal(result.clienteEncontrado, true);
  assert.equal(result.items[0].precioUnitarioFinal, 72);
  assert.equal(result.total, 144);
});

test('documento sin tipo encuentra cliente y precede a razon social', async () => {
  const f = fixture([{ id: 2954, razon_social: 'PONCE', documento: '20-43293235-5', tipo_documento: null,
    id_tipo_precio: 2, bonificacion_general: '0' }]);
  const result = await f.quote({ clienteId: 9999, tipoDocumento: 'CUIT', numeroDocumento: '20432932355', razonSocial: 'OTRO' });
  assert.deepEqual(f.calls, ['id', 'documentoConTipo', 'documento']);
  assert.equal(result.items[0].precioUnitarioFinal, 80);
});

test('razon social exacta encuentra cliente y los duplicados dan 409', async () => {
  const client = { id: 1, razon_social: ' Inyecar ', documento: null, tipo_documento: null,
    id_tipo_precio: 2, bonificacion_general: '0' };
  const f = fixture([client]);
  assert.equal((await f.quote({ razonSocial: 'inyecar' })).clienteEncontrado, true);
  assert.deepEqual(f.calls, ['razonSocial']);
  const duplicates = fixture([client, { ...client, id: 2 }]);
  await assert.rejects(() => duplicates.quote({ razonSocial: 'inyecar' }), (error) => error.status === 409);
});

test('sin cliente usa Mostrador y compara snapshots de Mostrador', async () => {
  const f = fixture([]);
  const first = await f.quote({ razonSocial: 'CONSUMIDOR FINAL' });
  assert.equal(first.clienteEncontrado, false);
  assert.equal(first.items[0].precioUnitarioFinal, 100);
  assert.equal(first.total, 200);
  assert.deepEqual(f.calls, []);
  assert.equal(f.saved.get(first.cotizacionId).clienteId, null);
  f.prices.mostrador = 120;
  const second = await f.quote({ cotizacionAnteriorId: first.cotizacionId });
  assert.equal(second.items[0].precioUnitarioFinal, 120);
  assert.deepEqual(second.cambiosPrecio, ['ABC']);
  assert.equal(second.requiereConfirmarCambios, true);
  assert.equal(second.puedeConfirmar, false);
});
