import { query } from "../src/lib/db-utils";

async function run() {
    try {
        console.log("Iniciando actualización de restricciones...");
        
        // 1. Buscar el nombre de la restricción de check para la columna 'tipo' en 'operacion'
        const res = await query(`
            SELECT conname 
            FROM pg_constraint 
            WHERE conrelid = 'public.operacion'::regclass 
            AND contype = 'c' 
            AND pg_get_constraintdef(oid) LIKE '%tipo%';
        `);

        if (res.rows.length > 0) {
            for (const row of res.rows) {
                console.log(`Eliminando restricción antigua: ${row.conname}`);
                await query(`ALTER TABLE public.operacion DROP CONSTRAINT ${row.conname}`);
            }
        }

        // 2. Crear la nueva restricción que incluye AJUSTE
        console.log("Creando nueva restricción con 'AJUSTE'...");
        await query(`
            ALTER TABLE public.operacion 
            ADD CONSTRAINT operacion_tipo_check 
            CHECK (upper(TRIM(BOTH FROM tipo)) = ANY (ARRAY['COMPRA'::text, 'VENTA'::text, 'AJUSTE'::text]));
        `);

        console.log("¡Base de datos actualizada con éxito!");
        process.exit(0);
    } catch (error) {
        console.error("Error al actualizar la base de datos:", error);
        process.exit(1);
    }
}

run();
