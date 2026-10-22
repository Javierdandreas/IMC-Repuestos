const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resumirLote, loteFinalizado } = require('../src/lib/resumen-lote-publicacion.ts');

test('no considera terminado un lote vacio, pendiente o incierto', () => {
  assert.equal(loteFinalizado([]), false);
  assert.equal(loteFinalizado([{ estado: 'CREADA' }, { estado: 'RECHAZADA' }]), true);
  for (const estado of ['PENDIENTE', 'EJECUTANDO', 'INCIERTO']) {
    assert.equal(loteFinalizado([{ estado: 'CREADA' }, { estado }]), false);
  }
});

test('cuenta resultados y distingue las compatibilidades sin verificar', () => {
  const items = [
    { estado: 'CREADA', resultado: { descripcionEstado: 'GUARDADA', compatibilidades: { estado: 'SOLICITADA', origen: 8, destino: 8 } } },
    { estado: 'CREADA', resultado: { descripcionEstado: 'ERROR', compatibilidades: { estado: 'SOLICITADA_SIN_VERIFICAR', origen: 8, destino: null } } },
    { estado: 'CREADA', resultado: { descripcionEstado: 'GUARDADA', compatibilidades: { estado: 'COMPARTIDAS', origen: 8, destino: 8 } } },
    { estado: 'RECHAZADA', resultado: { resultado: 'RECHAZADA' } },
    { estado: 'INCIERTO', resultado: null },
  ];
  assert.deepEqual(resumirLote(items), { creadas: 3, rechazadas: 1, sinConfirmar: 1, destinosConsultados: 2, totalDestinos: 16, sinVerificar: 1, descripcionesConProblemas: 1 });
});

test('un origen sin compatibilidades no se informa como fallo de verificacion', () => {
  const resumen = resumirLote([{ estado: 'CREADA', resultado: { descripcionEstado: 'SIN_DESCRIPCION', compatibilidades: { estado: 'SIN_ORIGEN', origen: 0, destino: null } } }]);
  assert.equal(resumen.sinVerificar, 0);
  assert.equal(resumen.destinosConsultados, 0);
});
