import { query } from "../src/lib/db-utils";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function check() {
  const manualCount = await query("SELECT COUNT(*)::int as count FROM productos WHERE criterio_costo = 'MANUAL'");
  console.log("Total productos MANUAL:", manualCount.rows[0].count);

  const ppCount = await query("SELECT COUNT(*)::int as count FROM producto_precio WHERE id_tipo_precio = 1 AND modo_calculo = 'FIJO_MONEDA'");
  console.log("Total producto_precio FIJO_MONEDA:", ppCount.rows[0].count);

  const ppCostos = await query("SELECT COUNT(*)::int as count FROM producto_precio WHERE id_tipo_precio = 1");
  console.log("Total producto_precio PRECIO COSTO:", ppCostos.rows[0].count);

  const prodWithCosto = await query("SELECT p.id, p.cod_unico, pp.precio, pp.modo_calculo, pp.importe_origen, pp.moneda_origen FROM productos p JOIN producto_precio pp ON pp.id_producto = p.id AND pp.id_tipo_precio = 1 WHERE pp.modo_calculo = 'FIJO_MONEDA' LIMIT 5");
  console.log("Ejemplos con FIJO_MONEDA:", prodWithCosto.rows);
}
check().catch(console.error).finally(() => process.exit(0));
