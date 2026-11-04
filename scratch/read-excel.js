const XLSX = require("xlsx");
const path = "C:\\Users\\Computadora\\Downloads\\MIGRACION COSTOS Y MARGENES.xls";

const workbook = XLSX.readFile(path);
console.log("Sheet names:", workbook.SheetNames);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const json = XLSX.utils.sheet_to_json(sheet);
console.log("Headers:", Object.keys(json[0] || {}));
console.log("Row 0:", json[0]);
console.log("Row 1:", json[1]);

// Let's find 3397011629BOSCH in this file!
const found = json.find(row => Object.values(row).some(v => String(v).includes("3397011629BOSCH")));
console.log("Row with 3397011629BOSCH:", found);
