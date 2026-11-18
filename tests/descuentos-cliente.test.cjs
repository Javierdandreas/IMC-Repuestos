const test = require('node:test');
const assert = require('node:assert/strict');
const { calcularPrecioCliente, resolverDescuentoCliente, reglaDescuentoClienteSchema } = require('../src/lib/descuentos-cliente.ts');
const scope = { id_marca: 1, id_categoria: 10, id_subcategoria: 20 };
const rule = (fields, descuento) => ({ id_marca:null, id_categoria:null, id_subcategoria:null, ...fields, descuento });

test('usa bonificacion general solo si no hay regla; un descuento 0 la reemplaza', () => {
  assert.equal(resolverDescuentoCliente([], scope, 15).descuento,15);
  assert.equal(resolverDescuentoCliente([rule({id_marca:1},0)], scope, 15).descuento,0);
  assert.equal(resolverDescuentoCliente([rule({id_marca:2},30)], scope, 15).descuento,15);
});
test('la regla mas especifica reemplaza a la amplia aunque tenga descuento menor', () => {
  const rules = [rule({id_marca:1},20), rule(scope,5), rule({id_categoria:10},30)];
  assert.equal(resolverDescuentoCliente(rules,scope,10).descuento,5);
  assert.equal(calcularPrecioCliente(100000,5),95000);
});
test('las reglas cruzadas usan el mayor porcentaje sin acumular', () => {
  const rules = [rule({id_marca:1},3),rule({id_categoria:10,id_subcategoria:20},5)];
  assert.equal(resolverDescuentoCliente(rules,scope,10).descuento,5);
  assert.equal(resolverDescuentoCliente([...rules].reverse(),scope,10).descuento,5);
});
test('una subcategoria normalizada prevalece sobre su categoria', () => {
  assert.equal(resolverDescuentoCliente([rule({id_categoria:10},15),rule({id_categoria:10,id_subcategoria:20},2)],scope,0).descuento,2);
});
test('calcula centavos, admite 100% y rechaza valores invalidos', () => {
  assert.equal(calcularPrecioCliente(0.05,10),0.05);
  assert.equal(calcularPrecioCliente(143653.38,5),136470.71);
  assert.equal(calcularPrecioCliente(100,100),0);
  assert.throws(()=>calcularPrecioCliente(0,5));
  assert.throws(()=>calcularPrecioCliente(100,101));
  assert.throws(()=>calcularPrecioCliente(NaN,5));
});
test('valida alcance, porcentaje y precision', () => {
  assert.equal(reglaDescuentoClienteSchema.safeParse(rule({},10)).success,false);
  assert.equal(reglaDescuentoClienteSchema.safeParse(rule({id_marca:1},10.001)).success,false);
  assert.equal(reglaDescuentoClienteSchema.safeParse(rule({id_marca:1},100)).success,true);
});
