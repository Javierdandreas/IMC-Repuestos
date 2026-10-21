const { test } = require('node:test');
const assert = require('node:assert/strict');
const { planCopiaCompatibilidades, totalCompatibilidades, dominiosCompatibles, totalResumen } = require('../src/lib/mercadolibre-copia-compatibilidades.ts');

test('elige la operacion sin alterar un producto compartido', () => {
  assert.equal(planCopiaCompatibilidades('UP1', 'UP1', 76, 76), 'COMPARTIDAS');
  assert.equal(planCopiaCompatibilidades('UP1', 'UP2', 76, 0), 'COPIAR');
  assert.equal(planCopiaCompatibilidades('UP1', 'UP2', 76, 4), 'ACTUALIZAR');
  assert.equal(planCopiaCompatibilidades('UP1', 'UP2', 0, 0), 'SIN_ORIGEN');
  assert.equal(planCopiaCompatibilidades('UP1', null, 76, 0), 'DESCONOCIDO');
  assert.equal(planCopiaCompatibilidades('UP1', 'UP2', null, 0), 'DESCONOCIDO');
});

test('no interpreta un contador ausente como cero', () => {
  assert.equal(totalCompatibilidades({ paging: { total: 76 } }), 76);
  assert.equal(totalCompatibilidades({ products: [] }), null);
  assert.equal(totalCompatibilidades({ paging: { total: -1 } }), null);
});

test('identifica dominios de la categoria sin repetirlos', () => {
  const dump = [[{ compatibilities: [
    { type: 'EXTENSION', compatible_domain_id: 'MLA-CARS_AND_VANS', categories: [{ id: 'MLA123' }] },
    { type: 'EXTENSION', compatible_domain_id: 'MLA-CARS_AND_VANS', categories: [{ id: 'MLA123' }] },
    { type: 'EXTENSION', compatible_domain_id: 'MLA-MOTORCYCLES', categories: [{ id: 'MLA456' }] },
  ] }]];
  assert.deepEqual(dominiosCompatibles(dump, 'MLA123'), ['MLA-CARS_AND_VANS']);
  assert.deepEqual(dominiosCompatibles(dump, 'MLA999'), []);
});

test('usa solo conteos validos del resumen para el item pedido', () => {
  const summary = [{ item_id: 'MLA1', compatibilities_count: 76 }, { item_id: 'MLA2', compatibilities_count: 0 }];
  assert.equal(totalResumen(summary, 'MLA1'), 76);
  assert.equal(totalResumen(summary, 'MLA2'), 0);
  assert.equal(totalResumen(summary, 'MLA3'), null);
  assert.equal(totalResumen([{ item_id: 'MLA1' }], 'MLA1'), null);
  assert.equal(totalResumen([...summary, summary[0]], 'MLA1'), null);
});
