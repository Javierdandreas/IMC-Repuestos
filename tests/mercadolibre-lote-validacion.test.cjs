const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validarTitulosLote, loteBloqueado, descripcionParaPublicacion } = require('../src/lib/mercadolibre-lote-validacion.ts');

test('valida limites y titulos repetidos sin distinguir mayusculas', () => {
  assert.equal(validarTitulosLote(['Filtro Toyota', 'Filtro Honda']), true);
  assert.equal(validarTitulosLote(['Filtro Toyota', ' filtro toyota ']), false);
  assert.equal(validarTitulosLote([]), false);
  assert.equal(validarTitulosLote(['x'.repeat(61)]), false);
  assert.equal(validarTitulosLote(Array.from({ length: 21 }, (_, i) => `titulo ${i}`)), false);
  assert.equal(validarTitulosLote(['   ']), false);
});

test('usa la descripcion propia y conserva la comun en lotes anteriores', () => {
  assert.equal(descripcionParaPublicacion('Descripcion Prius', 'Descripcion comun'), 'Descripcion Prius');
  assert.equal(descripcionParaPublicacion(null, 'Descripcion comun'), 'Descripcion comun');
});

test('detiene el lote mientras existe una publicacion incierta o ejecutandose', () => {
  assert.equal(loteBloqueado([{ estado: 'CREADA' }, { estado: 'PENDIENTE' }]), false);
  assert.equal(loteBloqueado([{ estado: 'INCIERTO' }, { estado: 'PENDIENTE' }]), true);
  assert.equal(loteBloqueado([{ estado: 'EJECUTANDO' }]), true);
});
