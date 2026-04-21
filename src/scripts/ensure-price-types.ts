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
        "MECANICO"
    ];

    try {
        for (const tipo of tipos) {
            const res = await query("SELECT id FROM public.tipo_precio WHERE descripcion = $1", [tipo]);
            
            if (res.rowCount === 0) {
                await query("INSERT INTO public.tipo_precio (descripcion) VALUES ($1)", [tipo]);
                console.log(`✅ Creado: ${tipo}`);
            } else {
                console.log(`ℹ️ Ya existe: ${tipo}`);
            }
        }
        console.log("--- Proceso completado ---");
    } catch (error) {
        console.error("❌ Error en la migración de tipos de precio:", error);
        process.exit(1);
    }
}

main();
