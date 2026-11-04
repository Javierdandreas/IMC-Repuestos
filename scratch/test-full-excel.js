const XLSX = require("xlsx");
const path = "C:\\Users\\Computadora\\Downloads\\MIGRACION COSTOS Y MARGENES.xls";

function parseNullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const cleaned = String(value).replace(/[^\d,.-]/g, "").trim();
  if (!cleaned) return null;

  const firstDot = cleaned.indexOf(".");
  const lastDot = cleaned.lastIndexOf(".");
  const firstComma = cleaned.indexOf(",");
  const lastComma = cleaned.lastIndexOf(",");

  let normalized = cleaned;
  if (lastDot !== -1 && lastComma !== -1) {
    if (lastComma > lastDot) {
      normalized = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = cleaned.replace(/,/g, "");
    }
  } else if (lastComma !== -1) {
    if (firstComma !== lastComma) {
      normalized = cleaned.replace(/,/g, "");
    } else {
      normalized = cleaned.replace(",", ".");
    }
  } else if (lastDot !== -1) {
    if (firstDot !== lastDot) {
      normalized = cleaned.replace(/\./g, "");
    } else {
      normalized = cleaned;
    }
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolverCodigoCotizacionCostoBase(value) {
  const normalized = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
  if (!normalized) return null;

  if (normalized === "$" || normalized.startsWith("$")) {
    return { moneda: "ARS", referencia: null, codigoCotizacion: "ARS" };
  }
  if (normalized.includes("€")) {
    return { moneda: "EUR", referencia: "OFICIAL", codigoCotizacion: "EUR_OFICIAL" };
  }

  const compact = normalized.replace(/[^A-Z0-9]/g, "");
  if (["0", "ARS", "PESO", "PESOS", "PESOARGENTINO", "PESOSARGENTINOS", "AR", "ARG"].includes(compact)) {
    return { moneda: "ARS", referencia: null, codigoCotizacion: "ARS" };
  }
  if (["1", "USDBLUE", "DOLARBLUE", "DOLARESBLUE", "UB"].includes(compact) || compact.includes("BLUE") || compact.startsWith("UB")) {
    return { moneda: "USD", referencia: "BLUE", codigoCotizacion: "USD_BLUE" };
  }
  if (["2", "USDCCL", "DOLARCCL"].includes(compact) || compact.includes("CCL") || compact.includes("LIQUI")) {
    return { moneda: "USD", referencia: "CCL", codigoCotizacion: "USD_CCL" };
  }
  if (["3", "USDMEP", "DOLARMEP"].includes(compact) || compact.includes("MEP")) {
    return { moneda: "USD", referencia: "MEP", codigoCotizacion: "USD_MEP" };
  }
  if (["4", "USDOFICIAL", "DOLAROFICIAL"].includes(compact) || compact.includes("OFICIAL")) {
    return { moneda: "USD", referencia: "OFICIAL", codigoCotizacion: "USD_OFICIAL" };
  }
  if (["5", "EUR", "EURO", "EUROS", "EUROOFICIAL"].includes(compact) || compact.startsWith("EUR") || compact.includes("EURO")) {
    return { moneda: "EUR", referencia: "OFICIAL", codigoCotizacion: "EUR_OFICIAL" };
  }
  if (["6", "BRL", "REAL", "REALES", "REALBRASILENO"].includes(compact) || compact.startsWith("BRL") || compact.includes("REAL")) {
    return { moneda: "BRL", referencia: "OFICIAL", codigoCotizacion: "BRL_OFICIAL" };
  }
  if (["USD", "DOLAR", "DOLARES", "US", "UD"].includes(compact) || compact.startsWith("USD")) {
    return { moneda: "USD", referencia: "BLUE", codigoCotizacion: "USD_BLUE" };
  }
  return null;
}

const workbook = XLSX.readFile(path);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const json = XLSX.utils.sheet_to_json(sheet);

let parsedCosts = 0;
let failedCosts = 0;
let parsedCurrencies = 0;
let failedCurrencies = 0;

for (let i = 0; i < json.length; i++) {
  const row = json[i];
  const num = parseNullableNumber(row["COSTO BASE"]);
  if (num !== null) {
    parsedCosts++;
  } else {
    failedCosts++;
    if (failedCosts <= 5) console.log("Failed cost row:", row);
  }

  const cur = resolverCodigoCotizacionCostoBase(row["MONEDA"]) || resolverCodigoCotizacionCostoBase(row["COSTO BASE"]);
  if (cur !== null) {
    parsedCurrencies++;
  } else {
    failedCurrencies++;
    if (failedCurrencies <= 5) console.log("Failed cur row:", row);
  }
}

console.log(`Total rows: ${json.length}`);
console.log(`Parsed costs: ${parsedCosts}, Failed: ${failedCosts}`);
console.log(`Parsed currencies: ${parsedCurrencies}, Failed: ${failedCurrencies}`);
