const assert = require("node:assert/strict");
const test = require("node:test");
const { limitarDescripcionCatalogoExterno } = require("../src/lib/descripcion-catalogo-externo.ts");

test("conserva descripciones de hasta 150 caracteres y recorta las mas largas", () => {
  assert.equal(limitarDescripcionCatalogoExterno("A".repeat(150)), "A".repeat(150));
  assert.equal(limitarDescripcionCatalogoExterno("A".repeat(151)), "A".repeat(150));
  assert.equal(limitarDescripcionCatalogoExterno("Producto"), "Producto");
});

test("cuenta caracteres Unicode sin dividir pares sustitutos", () => {
  const text = "A".repeat(149) + "\u{1F527}" + "B";
  assert.equal(limitarDescripcionCatalogoExterno(text), "A".repeat(149) + "\u{1F527}");
});
