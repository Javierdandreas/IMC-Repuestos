BEGIN;

-- La API expone valores encadenados. Esta cola permite recorrerlos por ramas
-- cortas y reanudar la carga sin depender de una ejecucion larga.
CREATE TABLE IF NOT EXISTS public.mercadolibre_catalogo_vehiculo_cola (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dominio_id text NOT NULL DEFAULT 'MLA-CARS_AND_VANS',
  atributos jsonb NOT NULL,
  firma text NOT NULL,
  siguiente_atributo_id text NOT NULL CHECK (siguiente_atributo_id IN ('MODEL', 'VEHICLE_YEAR', 'ENGINE', 'POWER', 'SAVE')),
  prioridad smallint NOT NULL DEFAULT 0,
  estado text NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'PROCESANDO', 'COMPLETADA', 'ERROR')),
  intentos smallint NOT NULL DEFAULT 0,
  ultimo_error text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT mercadolibre_catalogo_vehiculo_cola_atributos_array_check CHECK (jsonb_typeof(atributos) = 'array'),
  CONSTRAINT mercadolibre_catalogo_vehiculo_cola_unique UNIQUE (dominio_id, firma, siguiente_atributo_id)
);

CREATE INDEX IF NOT EXISTS idx_ml_catalogo_vehiculo_cola_pendiente
  ON public.mercadolibre_catalogo_vehiculo_cola (dominio_id, estado, prioridad DESC, id DESC);

ALTER TABLE public.mercadolibre_catalogo_vehiculo
  DROP CONSTRAINT IF EXISTS mercadolibre_catalogo_vehiculo_origen_check;

ALTER TABLE public.mercadolibre_catalogo_vehiculo
  ADD CONSTRAINT mercadolibre_catalogo_vehiculo_origen_check
  CHECK (origen IN ('COMPATIBILIDAD', 'IMPORTACION', 'API'));

COMMIT;
