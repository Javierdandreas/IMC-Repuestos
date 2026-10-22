const { test } = require('node:test');
const assert = require('node:assert/strict');
const { opcionMensajePersonalizado, ventaAptaParaMensaje, estadoMensajeVenta } = require('../src/lib/mercadolibre-mensajes-prueba.ts');

test('permite solo la opcion OTHER habilitada con cupo disponible', () => {
  const option = { id: 'OTHER', enabled: true, actionable: true, cap_available: 1, char_limit: 200 };
  assert.deepEqual(opcionMensajePersonalizado({ options: [option] }), { disponible: true, limite: 200 });
  assert.equal(opcionMensajePersonalizado({ options: [{ ...option, cap_available: 0 }] }).disponible, false);
  assert.equal(opcionMensajePersonalizado({ options: [{ ...option, enabled: false }] }).disponible, false);
  assert.equal(opcionMensajePersonalizado({ options: [{ ...option, actionable: false }] }).disponible, false);
  assert.equal(opcionMensajePersonalizado({ options: [] }).disponible, false);
  assert.equal(opcionMensajePersonalizado(null).disponible, false);
  assert.equal(opcionMensajePersonalizado({ options: [{ ...option, char_limit: 500 }] }).limite, 350);
});

test('distingue disponible, rechazado, incierto y ausencia de registro', () => {
  assert.equal(estadoMensajeVenta(null, null).tipo, 'SIN_REGISTRO');
  assert.equal(estadoMensajeVenta('RECIBIDO', 'Estado en Mercado Libre: available.').tipo, 'DISPONIBLE');
  assert.equal(estadoMensajeVenta('RECIBIDO', 'Estado en Mercado Libre: rejected.').tipo, 'ERROR');
  assert.equal(estadoMensajeVenta('RECIBIDO', 'Estado en Mercado Libre: pending.').tipo, 'INCIERTO');
  assert.equal(estadoMensajeVenta('RECIBIDO', null).tipo, 'INCIERTO');
  assert.equal(estadoMensajeVenta('INCIERTO', null).tipo, 'INCIERTO');
  assert.equal(estadoMensajeVenta('ERROR', 'No se pudo enviar').tipo, 'ERROR');
});

test('solo incluye ventas pagadas a partir de la activacion', () => {
  const inicio = '2026-10-22T15:00:00Z';
  assert.equal(ventaAptaParaMensaje('paid', '2026-10-22T15:00:01Z', inicio), true);
  assert.equal(ventaAptaParaMensaje('paid', '2026-10-22T14:59:59Z', inicio), false);
  assert.equal(ventaAptaParaMensaje('cancelled', '2026-10-22T15:00:01Z', inicio), false);
  assert.equal(ventaAptaParaMensaje('paid', 'invalido', inicio), false);
  assert.equal(ventaAptaParaMensaje('paid', '2026-10-22T15:00:01Z', null), false);
});
