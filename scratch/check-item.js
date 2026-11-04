require("dotenv").config({ path: ".env.local" });
const { query } = require("./src/lib/db-utils");

async function check() {
  const prod = await query("SELECT id, cod_unico, descripcion, criterio_costo FROM productos WHERE cod_unico ILIKE $1", ['%3397011629BOSCH%']);
  console.log("Producto:", prod.rows);
  if (prod.rows.length > 0) {
    const id = prod.rows[0].id;
    const precios = await query("SELECT pp.*, tp.descripcion as tipo_desc FROM producto_precio pp JOIN tipo_precio tp ON tp.id = pp.id_tipo_precio WHERE pp.id_producto = $1 ORDER BY tp.id", [id]);
    console.log("Precios:", precios.rows);
  }

  const lastLog = await query("SELECT * FROM log_importaciones ORDER BY fecha DESC LIMIT 1");
  console.log("Ultimo log:", lastLog.rows);
}
check().catch(console.error).finally(() => process.exit(0));
