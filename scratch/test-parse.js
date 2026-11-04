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
      // European/Latin style: 1.250,50
      normalized = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      // US style: 1,250.50
      normalized = cleaned.replace(/,/g, "");
    }
  } else if (lastComma !== -1) {
    if (firstComma !== lastComma) {
      // Multiple commas: 1,250,000
      normalized = cleaned.replace(/,/g, "");
    } else {
      normalized = cleaned.replace(",", ".");
    }
  } else if (lastDot !== -1) {
    if (firstDot !== lastDot) {
      // Multiple dots: 1.250.000
      normalized = cleaned.replace(/\./g, "");
    } else {
      normalized = cleaned;
    }
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

const tests = [
  "u$B 16.00",
  "€ 7.16",
  "u$B 21.00",
  "16.00",
  "16,50",
  "$ 1.250,50",
  "USD 2,500.00",
  16.00,
  null,
  "",
  "-",
];
tests.forEach(t => console.log(`${t} ->`, parseNullableNumber(t)));
