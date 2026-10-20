const assert = require("node:assert/strict");
const test = require("node:test");
const { calcularCotizacionProveedor } = require("../src/lib/cotizacion-proveedor.ts");

test("aplica recargo porcentual o fijo sobre la cotizacion", () => {
  assert.equal(calcularCotizacionProveedor(1000, "PORCENTAJE", 10), 1100);
  assert.equal(calcularCotizacionProveedor(1000, "MONTO_FIJO", 15), 1015);
  assert.equal(calcularCotizacionProveedor(1000, "PORCENTAJE", 0), 1000);
});

test("rechaza cotizaciones y recargos invalidos", () => {
  assert.equal(calcularCotizacionProveedor(0, "PORCENTAJE", 0), null);
  assert.equal(calcularCotizacionProveedor(NaN, "PORCENTAJE", 0), null);
  assert.equal(calcularCotizacionProveedor(1000, "PORCENTAJE", -1), null);
  assert.equal(calcularCotizacionProveedor(1000, "OTRO", 1), null);
});
