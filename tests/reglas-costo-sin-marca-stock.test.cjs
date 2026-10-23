const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calcularCostoConReglasProveedor, validarReglaCostoProveedor } = require('../src/lib/reglas-costo-proveedor.ts');

const regla = (overrides = {}) => ({ nombre: 'Capa', alcance: 'SIN_MARCA_STOCK', id_marca: null, tipo_ajuste: 'DESCUENTO_PORCENTUAL', valor: 3, orden: 0, activo: true, condicion_tipo: 'STOCK_TEXTO', condicion_operador: 'CONTIENE', condicion_valor: 'DISPONIBLE', ...overrides });
const especial = (overrides = {}) => regla({ nombre: 'MANN', alcance: 'MARCA', id_marca: 10, valor: 5, orden: 1, ...overrides });

test('aplica la capa especifica o la alternativa segun marca y stock', () => {
  const reglas = [regla(), especial()];
  assert.equal(calcularCostoConReglasProveedor(100, reglas, 10, 'DISPONIBLE'), 95);
  assert.equal(calcularCostoConReglasProveedor(100, reglas, 20, 'DISPONIBLE'), 97);
  assert.equal(calcularCostoConReglasProveedor(100, reglas, null, 'DISPONIBLE'), 100);
  assert.equal(calcularCostoConReglasProveedor(100, reglas, 20, 'POR PEDIDO'), 100);
});

test('requiere coincidencia de condicion, marca y capa activa', () => {
  assert.equal(calcularCostoConReglasProveedor(100, [regla(), especial({ activo: false })], 10, 'DISPONIBLE'), 97);
  assert.equal(calcularCostoConReglasProveedor(100, [regla(), especial({ condicion_valor: 'POR PEDIDO' })], 10, 'DISPONIBLE'), 97);
  assert.equal(calcularCostoConReglasProveedor(100, [regla({ condicion_valor: 'disponible' }), especial({ condicion_valor: 'DISPONIBLE' })], 10, 'DISPONIBLE'), 95);
  assert.equal(calcularCostoConReglasProveedor(100, [regla(), especial({ condicion_tipo: 'SIEMPRE', condicion_valor: null })], 10, 'DISPONIBLE'), 92.15);
});

test('mantiene la acumulacion de capas generales existentes', () => {
  assert.equal(calcularCostoConReglasProveedor(100, [regla({ alcance: 'GENERAL' }), especial()], 10, 'DISPONIBLE'), 92.15);
  assert.equal(calcularCostoConReglasProveedor(100, [regla(), especial(), regla({ alcance: 'GENERAL', nombre: 'Extra', condicion_tipo: 'SIEMPRE', condicion_valor: null, valor: 10, orden: 2 })], 10, 'DISPONIBLE'), 85.5);
});

test('valida que el alcance alternativo tenga stock y ninguna marca', () => {
  assert.equal(validarReglaCostoProveedor(regla()), null);
  assert.ok(validarReglaCostoProveedor(regla({ condicion_tipo: 'SIEMPRE' })));
  assert.ok(validarReglaCostoProveedor(regla({ id_marca: 10 })));
});
