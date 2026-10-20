import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { esperarResultado } from "./resultado.mjs";

const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage();
  const vin = "WAUDFA8U6DR059615";
  await page.setContent(`<h4>${vin}</h4>`);
  assert.equal(await esperarResultado(page, vin, 1000), "ENCONTRADO");
  await page.setContent("<p>No se encontraron resultados para este chasis</p>");
  assert.equal(await esperarResultado(page, vin, 1000), "NO_ENCONTRADO");
  await page.setContent("<p>El n\u00famero de bastidor no pudo ser asignado correctamente. Por favor, int\u00e9ntelo de nuevo desde el cat\u00e1logo correcto.</p>");
  assert.equal(await esperarResultado(page, vin, 1000), "NO_ASIGNADO");
  await page.setContent("<p>El chasis no encontrado</p><p>CAPTCHA</p>");
  assert.equal(await esperarResultado(page, vin, 1000), "BLOQUEADO");
  await page.setContent('<input type="password">');
  assert.equal(await esperarResultado(page, vin, 1000), "BLOQUEADO");
  await page.setContent("<p>Mensaje desconocido</p>");
  await assert.rejects(esperarResultado(page, vin, 200), { name: "TimeoutError" });
  console.log("Pruebas de deteccion correctas.");
} finally { await browser.close(); }
