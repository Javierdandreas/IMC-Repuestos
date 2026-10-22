const { test } = require('node:test');
const assert = require('node:assert/strict');
const { opcionMensajePersonalizado } = require('../src/lib/mercadolibre-mensajes-prueba.ts');

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
