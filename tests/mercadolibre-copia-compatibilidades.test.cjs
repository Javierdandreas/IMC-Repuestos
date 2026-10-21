const { test } = require('node:test');
const assert = require('node:assert/strict');
const { planCopiaCompatibilidades, totalCompatibilidades } = require('../src/lib/mercadolibre-copia-compatibilidades.ts');

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
