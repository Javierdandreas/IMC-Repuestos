const { test } = require('node:test');
const assert = require('node:assert/strict');
const { atributosParaDescripcion } = require('../src/lib/mercadolibre-descripcion.ts');

test('extrae atributos legibles y omite SKU y datos no relevantes', () => {
  assert.deepEqual(atributosParaDescripcion([
    { id: 'BRAND', name: 'Marca', value_name: 'Victor Reinz' },
    { id: 'OEM', name: 'OEM', values: [{ name: '123' }, { name: '456' }] },
    { id: 'SELLER_SKU', value_name: 'JUNTAS34' },
    { id: 'ORIGIN', value_id: '-1', value_name: null },
  ]), [{ id: 'BRAND', nombre: 'Marca', valor: 'Victor Reinz' }, { id: 'OEM', nombre: 'OEM', valor: '123, 456' }]);
});
