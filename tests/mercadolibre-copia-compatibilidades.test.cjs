const { test } = require('node:test');
const assert = require('node:assert/strict');
const { planCopiaCompatibilidades, totalCompatibilidades, dominiosCompatibles, totalResumen, solicitudCopiaUserProduct } = require('../src/lib/mercadolibre-copia-compatibilidades.ts');

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

test('prepara copia a User Product con un solo origen y datos de categoria', () => {
  const desdeUP = solicitudCopiaUserProduct('MLA1', 'MLAU1', 'MLAU2', 'MLA123', 'MLA-CARS_AND_VANS');
  assert.equal(desdeUP.path, '/user-products/MLAU2/compatibilities/copy-paste');
  assert.deepEqual(desdeUP.body, { domain_id: 'MLA-CARS_AND_VANS', category_id: 'MLA123', item_id: null, user_product_id: 'MLAU1', extended_information: true });
  const desdeItem = solicitudCopiaUserProduct('MLA1', null, 'MLAU2', 'MLA123', 'MLA-CARS_AND_VANS');
  assert.equal(desdeItem.body.item_id, 'MLA1');
  assert.equal(desdeItem.body.user_product_id, null);
});
