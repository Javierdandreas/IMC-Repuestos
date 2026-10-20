import { chromium } from "playwright-core";
import XLSX from "xlsx";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { access } from "node:fs/promises";
import { extraerVehiculo } from "./extraer.mjs";
import { esperarResultado } from "./resultado.mjs";

const MAXIMO_POR_EJECUCION = 10;
const ESPERA_MS = 15000;
const PORTAL = "https://www.partslink24.com/portal-ui";
const inputPath = process.argv[2];
const outputPath = process.argv[3];
if (!inputPath || !outputPath || !/\.xlsx$/i.test(outputPath)) {
  console.error('Uso: npm run iniciar -- "entrada.xlsx" "salida.xlsx"');
  process.exit(1);
}
try { await access(outputPath); console.error("El archivo de salida ya existe. Elegi otro nombre para no sobrescribirlo."); process.exit(1); }
catch (error) { if (error.code !== "ENOENT") throw error; }

const workbook = XLSX.readFile(inputPath, { cellDates: false });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const source = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
if (!source.length) throw new Error("El Excel no tiene filas en la primera hoja.");
const column = Object.keys(source[0]).find((key) => /^(chasis|vin)$/i.test(key.trim()));
if (!column) throw new Error("La primera hoja debe tener una columna CHASIS o VIN.");
const vins = [...new Set(source.map((row) => String(row[column]).trim().toUpperCase()).filter(Boolean))];
const results = vins.map((vin) => ({ CHASIS: vin, MARCA: "", MODELO: "", MOTOR: "", "A\u00d1O": "", CILINDRADA: "", "FECHA DE PRODUCCION": "", ESTADO: "PENDIENTE", DETALLE: "" }));
function guardar() {
  const output = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(results);
  sheet["!cols"] = [{ wch: 22 }, { wch: 20 }, { wch: 40 }, { wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 22 }, { wch: 18 }, { wch: 65 }];
  XLSX.utils.book_append_sheet(output, sheet, "Chasis");
  XLSX.writeFile(output, outputPath);
}
guardar();

const browser = await chromium.launch({ channel: "msedge", headless: false });
const readline = createInterface({ input: stdin, output: stdout });
try {
  const page = await browser.newPage();
  await page.goto(PORTAL, { waitUntil: "domcontentloaded" });
  console.log("Inicia sesion manualmente en la ventana de Edge y deja abierta la pagina de inicio de Partslink.");
  await readline.question("Cuando aparezca el buscador de chasis, presiona Enter aqui (Ctrl+C cancela): ");
  const selectorInput = '[data-test-id="pl24-vinsearch-ui-vinSearch-input-search"]';
  const selectorButton = '[data-test-id="pl24-vinsearch-ui-vinSearch-input-button-search"]';
  await page.locator(selectorInput).waitFor({ state: "visible", timeout: 15000 });
  let intentos = 0;
  for (const row of results) {
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(row.CHASIS)) {
      row.ESTADO = "INVALIDO";
      row.DETALLE = "El chasis no tiene 17 caracteres VIN validos; revisar manualmente.";
      guardar();
      continue;
    }
    if (intentos >= MAXIMO_POR_EJECUCION) break;
    if (intentos > 0) await page.waitForTimeout(ESPERA_MS);
    intentos += 1;
    console.log(`Consultando ${intentos}/${MAXIMO_POR_EJECUCION}: ${row.CHASIS}`);
    try {
      if (intentos > 1) await page.goto(PORTAL, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.locator(selectorInput).waitFor({ state: "visible", timeout: 15000 });
      await page.locator(selectorInput).fill(row.CHASIS);
      await page.locator(selectorButton).click();
      let resultado;
      try {
        resultado = await esperarResultado(page, row.CHASIS);
      } catch (error) {
        if (error.name !== "TimeoutError") throw error;
        const respuesta = await readline.question("No se pudo identificar el resultado. Si la pantalla indica que el chasis no fue encontrado, escribi SI para continuar; cualquier otra respuesta detiene el proceso: ");
        if (respuesta.trim().toUpperCase() !== "SI") throw error;
        resultado = "NO_ENCONTRADO";
      }
      if (resultado === "BLOQUEADO") throw new Error("Partslink requiere iniciar sesion o muestra un control de seguridad.");
      if (resultado === "NO_ASIGNADO") {
        row.ESTADO = "NO ASIGNADO";
        row.DETALLE = "Partslink no pudo asignar el bastidor; revisar en el catalogo correcto.";
        guardar();
        console.log("Bastidor no asignado al catalogo. Se continuara con el siguiente.");
        continue;
      }
      if (resultado === "NO_ENCONTRADO") {
        row.ESTADO = "NO ENCONTRADO";
        row.DETALLE = "Chasis no reconocido por Partslink; revisar manualmente.";
        guardar();
        console.log("Chasis no encontrado. Se continuara con el siguiente.");
        continue;
      }
      const data = await extraerVehiculo(page);
      if (data.chasis.toUpperCase() !== row.CHASIS || !data.modelo) throw new Error("No se pudo verificar que el resultado corresponda al chasis consultado.");
      row.MARCA = data.marca;
      row.MODELO = data.modelo;
      row.MOTOR = data.motor;
      row["A\u00d1O"] = data.anio;
      row.CILINDRADA = data.cilindrada;
      row["FECHA DE PRODUCCION"] = data.fechaProduccion;
      row.ESTADO = data.marca && data.modelo && data.motor && data.anio && data.cilindrada ? "IDENTIFICADO" : "INCOMPLETO";
      row.DETALLE = row.ESTADO === "INCOMPLETO" ? "Faltan datos; revisar antes de usar." : "";
      guardar();
    } catch (error) {
      row.ESTADO = "REVISAR";
      row.DETALLE = "No se pudo verificar el resultado. El proceso se detuvo; revisa la ventana de Partslink.";
      guardar();
      console.error("Consulta detenida:", error.message);
      break;
    }
  }
  console.log(`Resultado guardado en ${outputPath}. Los chasis restantes quedan como PENDIENTE.`);
  await readline.question("Presiona Enter para cerrar el navegador: ");
} finally {
  readline.close();
  await browser.close();
}
