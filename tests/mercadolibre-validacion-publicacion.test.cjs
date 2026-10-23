const { test } = require('node:test');
const assert = require('node:assert/strict');
const { prepararValidacionPublicacion, interpretarValidacionPublicacion, protegerDiagnostico } = require('../src/lib/mercadolibre-validacion-publicacion.ts');

test('prepara una propuesta de User Product sin identificadores de la publicacion', () => {
  const result = prepararValidacionPublicacion({
    id: 'MLA1', user_product_id: 'MLAU1', title: 'Anterior', seller_id: 123,
    category_id: 'MLA123', price: 50, currency_id: 'ARS', available_quantity: 5,
    shipping: { mode: 'me2', local_pick_up: false, free_shipping: true, logistic_type: 'fulfillment' },
    pictures: [{ id: 'foto1', url: 'https://example.com/foto' }],
    attributes: [{ id: 'BRAND', value_id: '123', value_name: 'Marca', tags: {} },
      { id: 'CATALOG_TITLE', value_name: 'Titulo' }, { id: 'HAS_COMPATIBILITIES', value_name: 'Si' }],
  }, 'Nombre nuevo');
  assert.equal(result.family_name, 'Nombre nuevo');
  assert.equal(result.title, undefined);
  assert.equal(result.id, undefined);
  assert.equal(result.user_product_id, undefined);
  assert.equal(result.seller_id, undefined);
  assert.deepEqual(result.pictures, [{ id: 'foto1' }]);
  assert.deepEqual(result.shipping, { mode: 'me2', local_pick_up: false, free_shipping: true });
  assert.deepEqual(result.attributes, [{ id: 'BRAND', value_id: '123' }]);
});

test('no supone configuracion para otros modos de envio', () => {
  assert.equal(prepararValidacionPublicacion({ shipping: { mode: 'custom' } }, 'Nombre').shipping, undefined);
});

test('omite atributos no modificables y material sin un nombre valido', () => {
  const result = prepararValidacionPublicacion({
    attributes: [
      { id: 'SELLER_PACKAGE_DATA_SOURCE', value_name: 'source' },
      { id: 'SYI_PYMES_ID', value_name: '123' },
      { id: 'MATERIAL', value_id: 'legacy-material', value_name: null },
      { id: 'BRAND', value_id: '123', value_name: 'Marca' },
    ],
  }, 'Titulo nuevo');
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

test('oculta credenciales incluso en respuestas anidadas o de texto', () => {
  const result = protegerDiagnostico({ authorization: 'Bearer abc', nested: [{ access_token: 'abc', message: 'fallo abc Bearer xyz' }] }, ['abc']);
  assert.equal(result.authorization, '[OCULTO]');
  assert.equal(result.nested[0].access_token, '[OCULTO]');
  assert.equal(result.nested[0].message, 'fallo [OCULTO] Bearer [OCULTO]');
});
