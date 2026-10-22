const { test } = require('node:test');
const assert = require('node:assert/strict');
const { CATALOGO_PERMISOS, ACCIONES_PERMISO, permisoValido, asignacionesValidas } = require('../src/lib/catalogo-permisos.ts');

test('los apartados y sus acciones son unicos y reconocidos', () => {
  const ids = CATALOGO_PERMISOS.map((apartado) => apartado.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const apartado of CATALOGO_PERMISOS) {
    assert.ok(apartado.acciones.includes('leer'));
    assert.equal(new Set(apartado.acciones).size, apartado.acciones.length);
    for (const accion of apartado.acciones) {
      assert.ok(ACCIONES_PERMISO.includes(accion));
      assert.equal(permisoValido(apartado.id, accion), true);
    }
  }
});

test('rechaza apartados o acciones no contemplados', () => {
  assert.equal(permisoValido('desconocido', 'leer'), false);
  assert.equal(permisoValido('movimientos_stock', 'escribir'), false);
  assert.equal(permisoValido('usuarios', 'exportar'), false);
});

test('solo acepta permisos conocidos sin duplicados y con lectura requerida', () => {
  assert.equal(asignacionesValidas([]), true);
  assert.equal(asignacionesValidas([{ apartado: 'productos', accion: 'leer' }, { apartado: 'productos', accion: 'escribir' }]), true);
  assert.equal(asignacionesValidas([{ apartado: 'productos', accion: 'escribir' }]), false);
  assert.equal(asignacionesValidas([{ apartado: 'productos', accion: 'leer' }, { apartado: 'productos', accion: 'leer' }]), false);
  assert.equal(asignacionesValidas([{ apartado: 'usuarios', accion: 'exportar' }]), false);
});
