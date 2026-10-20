import { chromium } from "playwright-core";
import { readFile } from "node:fs/promises";
import { extraerVehiculo } from "./extraer.mjs";

const archivo = process.argv[2];
if (!archivo) {
  console.error('Uso: npm run verificar-html -- "ruta-al-resultado.html"');
  process.exit(1);
}
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage({ javaScriptEnabled: false });
  await page.route("**/*", (route) => route.abort());
  await page.setContent(await readFile(archivo, "utf8"), { waitUntil: "domcontentloaded" });
  const data = await extraerVehiculo(page);
  if (!data.chasis || !data.modelo) throw new Error("No se encontraron chasis y modelo en el HTML guardado.");
  console.log(JSON.stringify(data, null, 2));
} finally { await browser.close(); }
