const { test } = require('node:test');
const assert = require('node:assert/strict');
const { prepararValidacionPublicacion, interpretarValidacionPublicacion } = require('../src/lib/mercadolibre-validacion-publicacion.ts');

test('prepara una propuesta de User Product sin identificadores de la publicacion', () => {
  const result = prepararValidacionPublicacion({
    id: 'MLA1', user_product_id: 'MLAU1', title: 'Anterior', seller_id: 123,
    category_id: 'MLA123', price: 50, currency_id: 'ARS', available_quantity: 5,
    pictures: [{ id: 'foto1', url: 'https://example.com/foto' }],
    attributes: [{ id: 'BRAND', value_id: '123', value_name: 'Marca', tags: {} }],
  }, 'Nombre nuevo');
  assert.equal(result.family_name, 'Nombre nuevo');
  assert.equal(result.title, undefined);
  assert.equal(result.id, undefined);
  assert.equal(result.user_product_id, undefined);
  assert.equal(result.seller_id, undefined);
  assert.deepEqual(result.pictures, [{ id: 'foto1' }]);
  assert.deepEqual(result.attributes, [{ id: 'BRAND', value_id: '123' }]);
});

test('usa titulo en el modelo anterior y no descarta valores numericos cero', () => {
  const result = prepararValidacionPublicacion({ price: 0, available_quantity: 0 }, 'Titulo nuevo');
  assert.equal(result.title, 'Titulo nuevo');
  assert.equal(result.price, 0);
  assert.equal(result.available_quantity, 0);
});

test('no prepara una propuesta incompleta para publicaciones con variaciones', () => {
  assert.throws(() => prepararValidacionPublicacion({ variations: [{ id: 1 }] }, 'Nombre'), /variaciones/);
});

test('conserva todos los errores y advertencias de la validacion', () => {
  const cause = Array.from({ length: 22 }, (_, i) => ({ type: i === 21 ? 'error' : 'warning', code: `code${i}`, message: `detalle${i}`, references: ['item.attributes'] }));
  const result = interpretarValidacionPublicacion(400, { message: 'Validation error', error: 'validation_error', cause });
  assert.equal(result.validada, false);
  assert.equal(result.error, 'validation_error');
  assert.equal(result.detalles.length, 22);
  assert.equal(result.detalles[21].tipo, 'error');
  assert.deepEqual(result.detalles[21].referencias, ['item.attributes']);
  assert.equal(interpretarValidacionPublicacion(204, null).validada, true);
});
