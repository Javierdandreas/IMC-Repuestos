const dotenv = require("dotenv");
const path = require("path");

// 1. Cargar variables de entorno inmediatamente
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// 2. Importar lo demás después
const { query } = require("../lib/db-utils");

async function main() {
    console.log("--- Asegurando tipos de precio ---");

    const tipos = [
        "PRECIO COSTO",
        "MERCADO LIBRE",
        "MOSTRADOR",
        "CUENTA CORRIENTE",
        "OFERTA"
    ];

    try {
        await query(`
            UPDATE public.tipo_precio
            SET descripcion = 'CUENTA CORRIENTE'
            WHERE UPPER(TRIM(descripcion)) = 'MECANICO'
              AND NOT EXISTS (
                SELECT 1 FROM public.tipo_precio WHERE UPPER(TRIM(descripcion)) = 'CUENTA CORRIENTE'
              )
        `);

        for (const tipo of tipos) {
            const res = await query("SELECT id FROM public.tipo_precio WHERE descripcion = $1", [tipo]);
            
            if (res.rowCount === 0) {
                await query("INSERT INTO public.tipo_precio (descripcion) VALUES ($1)", [tipo]);
                console.log(`✅ Creado: ${tipo}`);
            } else {
                console.log(`ℹ️ Ya existe: ${tipo}`);
            }
        }

        await query(`
            WITH cuenta_corriente AS (
              SELECT id
              FROM public.tipo_precio
              WHERE UPPER(TRIM(descripcion)) = 'CUENTA CORRIENTE'
              ORDER BY id
              LIMIT 1
            ),
            precios_mecanico AS (
              SELECT DISTINCT ON (pp.id_producto)
                pp.id_producto,
                pp.precio,
                pp.porcentaje_ganancia
              FROM public.producto_precio pp
              JOIN public.tipo_precio tp ON tp.id = pp.id_tipo_precio
              WHERE UPPER(TRIM(tp.descripcion)) = 'MECANICO'
              ORDER BY pp.id_producto, pp.id DESC
            )
            INSERT INTO public.producto_precio (id_producto, id_tipo_precio, precio, porcentaje_ganancia)
            SELECT pm.id_producto, cc.id, pm.precio, pm.porcentaje_ganancia
            FROM precios_mecanico pm
            CROSS JOIN cuenta_corriente cc
            WHERE NOT EXISTS (
              SELECT 1
              FROM public.producto_precio existente
              WHERE existente.id_producto = pm.id_producto
                AND existente.id_tipo_precio = cc.id
            )
        `);

        await query(`
            DELETE FROM public.producto_precio pp
            USING public.tipo_precio tp
            WHERE pp.id_tipo_precio = tp.id
              AND UPPER(TRIM(tp.descripcion)) = 'MECANICO'
        `);

        await query("DELETE FROM public.tipo_precio WHERE UPPER(TRIM(descripcion)) = 'MECANICO'");

        console.log("--- Proceso completado ---");
    } catch (error) {
        console.error("❌ Error en la migración de tipos de precio:", error);
        process.exit(1);
    }
}

main();
