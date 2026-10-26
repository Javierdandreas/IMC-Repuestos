BEGIN;

-- Una fila representa una configuracion concreta que IMC puede identificar de
-- forma estable. Los valores siguen usando los IDs de atributos de Mercado Libre.
CREATE TABLE IF NOT EXISTS public.mercadolibre_catalogo_vehiculo (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dominio_id text NOT NULL DEFAULT 'MLA-CARS_AND_VANS',
  firma text NOT NULL,
  atributos jsonb NOT NULL,
  marca_id text NOT NULL,
  modelo_id text NOT NULL,
  anio_id text NOT NULL,
  motor_id text NOT NULL,
  potencia_id text,
  marca_nombre text NOT NULL,
  modelo_nombre text NOT NULL,
  anio_nombre text NOT NULL,
  motor_nombre text NOT NULL,
  potencia_nombre text,
  origen text NOT NULL DEFAULT 'COMPATIBILIDAD' CHECK (origen IN ('COMPATIBILIDAD', 'IMPORTACION')),
  activa boolean NOT NULL DEFAULT TRUE,
  primera_vez_visto_at timestamptz NOT NULL DEFAULT NOW(),
  sincronizado_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT mercadolibre_catalogo_vehiculo_atributos_array_check CHECK (jsonb_typeof(atributos) = 'array'),
  CONSTRAINT mercadolibre_catalogo_vehiculo_firma_unique UNIQUE (dominio_id, firma)
);

CREATE INDEX IF NOT EXISTS idx_ml_catalogo_vehiculo_filtros
  ON public.mercadolibre_catalogo_vehiculo (dominio_id, marca_id, modelo_id, anio_id, motor_id, potencia_id)
  WHERE activa = TRUE;

ALTER TABLE public.mercadolibre_pieza_compatibilidad
  ADD COLUMN IF NOT EXISTS id_vehiculo bigint
  REFERENCES public.mercadolibre_catalogo_vehiculo(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ml_pieza_compatibilidad_vehiculo
  ON public.mercadolibre_pieza_compatibilidad (id_vehiculo)
  WHERE id_vehiculo IS NOT NULL;

-- Conserva el historial existente: solo se convierten en vehiculos las
-- compatibilidades que ya tienen los cuatro datos que definen una aplicacion.
WITH candidatas AS (
  SELECT DISTINCT ON (pc.dominio_id, pc.firma)
    pc.dominio_id,
    pc.firma,
    pc.atributos,
    (SELECT valor->>'valueId' FROM jsonb_array_elements(pc.atributos) AS valor WHERE valor->>'id' = 'BRAND' LIMIT 1) AS marca_id,
    (SELECT valor->>'valueId' FROM jsonb_array_elements(pc.atributos) AS valor WHERE valor->>'id' = 'MODEL' LIMIT 1) AS modelo_id,
    (SELECT valor->>'valueId' FROM jsonb_array_elements(pc.atributos) AS valor WHERE valor->>'id' = 'VEHICLE_YEAR' LIMIT 1) AS anio_id,
    (SELECT valor->>'valueId' FROM jsonb_array_elements(pc.atributos) AS valor WHERE valor->>'id' = 'ENGINE' LIMIT 1) AS motor_id,
    (SELECT valor->>'valueId' FROM jsonb_array_elements(pc.atributos) AS valor WHERE valor->>'id' = 'POWER' LIMIT 1) AS potencia_id,
    (SELECT valor->>'valueName' FROM jsonb_array_elements(pc.atributos) AS valor WHERE valor->>'id' = 'BRAND' LIMIT 1) AS marca_nombre,
    (SELECT valor->>'valueName' FROM jsonb_array_elements(pc.atributos) AS valor WHERE valor->>'id' = 'MODEL' LIMIT 1) AS modelo_nombre,
    (SELECT valor->>'valueName' FROM jsonb_array_elements(pc.atributos) AS valor WHERE valor->>'id' = 'VEHICLE_YEAR' LIMIT 1) AS anio_nombre,
    (SELECT valor->>'valueName' FROM jsonb_array_elements(pc.atributos) AS valor WHERE valor->>'id' = 'ENGINE' LIMIT 1) AS motor_nombre,
    (SELECT valor->>'valueName' FROM jsonb_array_elements(pc.atributos) AS valor WHERE valor->>'id' = 'POWER' LIMIT 1) AS potencia_nombre
  FROM public.mercadolibre_pieza_compatibilidad pc
)
INSERT INTO public.mercadolibre_catalogo_vehiculo (
  dominio_id, firma, atributos, marca_id, modelo_id, anio_id, motor_id, potencia_id,
  marca_nombre, modelo_nombre, anio_nombre, motor_nombre, potencia_nombre
)
SELECT
  dominio_id, firma, atributos, marca_id, modelo_id, anio_id, motor_id, potencia_id,
  marca_nombre, modelo_nombre, anio_nombre, motor_nombre, potencia_nombre
FROM candidatas
WHERE marca_id IS NOT NULL AND modelo_id IS NOT NULL AND anio_id IS NOT NULL AND motor_id IS NOT NULL
ON CONFLICT (dominio_id, firma) DO NOTHING;

UPDATE public.mercadolibre_pieza_compatibilidad pc
SET id_vehiculo = vehiculo.id
FROM public.mercadolibre_catalogo_vehiculo vehiculo
WHERE vehiculo.dominio_id = pc.dominio_id
  AND vehiculo.firma = pc.firma
  AND pc.id_vehiculo IS NULL;

COMMIT;
