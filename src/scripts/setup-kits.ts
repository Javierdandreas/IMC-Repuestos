import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config({ path: ".env.local" });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function setupKits() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    console.log("--- Iniciando migración de Kits y limpieza de Alegra ---");

    const catRes = await client.query("SELECT id FROM categoria WHERE descripcion = 'KIT'");
    let kitCatId: number;
    if (catRes.rowCount === 0) {
      const insertRes = await client.query("INSERT INTO categoria (descripcion) VALUES ('KIT') RETURNING id");
      kitCatId = insertRes.rows[0].id;
      console.log(`Categoría 'KIT' creada con ID: ${kitCatId}`);
    } else {
      kitCatId = catRes.rows[0].id;
      console.log(`Categoría 'KIT' ya existe con ID: ${kitCatId}`);
    }

    // 2. Eliminar columna alegra_id de productos (si existe)
    console.log("Eliminando columna 'alegra_id' de productos...");
    await client.query(`
      DO $$ 
      BEGIN 
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='productos' AND column_name='alegra_id') THEN
          ALTER TABLE productos DROP COLUMN alegra_id;
        END IF;
      END $$;
    `);

    // 3. Crear tabla kits
    console.log("Creando tabla 'kits'...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.kits (
        id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
        nombre character varying NOT NULL,
        descripcion text,
        codigo_kit character varying NOT NULL UNIQUE,
        id_categoria integer DEFAULT ${kitCatId},
        id_subcategoria integer,
        activo boolean DEFAULT true,
        created_at timestamp with time zone NOT NULL DEFAULT now(),
        CONSTRAINT kits_pkey PRIMARY KEY (id),
        CONSTRAINT kits_id_categoria_fkey FOREIGN KEY (id_categoria) REFERENCES public.categoria(id),
        CONSTRAINT kits_id_subcategoria_fkey FOREIGN KEY (id_subcategoria) REFERENCES public.subcategoria(id)
      );
    `);

    // 4. Crear tabla kit_detalle
    console.log("Creando tabla 'kit_detalle'...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.kit_detalle (
        id_kit integer NOT NULL,
        id_producto integer NOT NULL,
        cantidad integer NOT NULL DEFAULT 1,
        CONSTRAINT kit_detalle_pkey PRIMARY KEY (id_kit, id_producto),
        CONSTRAINT kit_detalle_id_kit_fkey FOREIGN KEY (id_kit) REFERENCES public.kits(id) ON DELETE CASCADE,
        CONSTRAINT kit_detalle_id_producto_fkey FOREIGN KEY (id_producto) REFERENCES public.productos(id)
      );
    `);

    await client.query("COMMIT");
    console.log("--- Migración completada con éxito ---");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Error en la migración:", error);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

setupKits();
