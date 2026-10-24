BEGIN;

-- Se reemplaza el historial de consultas de compradores por el catalogo tecnico
-- que se utiliza para asignar compatibilidades a las piezas.
DROP TABLE IF EXISTS public.mercadolibre_compatibilidad_candidata;

CREATE TABLE IF NOT EXISTS public.mercadolibre_catalogo_vehiculo_valor (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dominio_id text NOT NULL DEFAULT 'MLA-CARS_AND_VANS',
  atributo_id text NOT NULL,
  valor_id text NOT NULL,
  valor_nombre text NOT NULL,
  atributos_conocidos jsonb NOT NULL DEFAULT '[]'::jsonb,
  contexto_clave text NOT NULL DEFAULT '',
  primera_vez_visto_at timestamptz NOT NULL DEFAULT NOW(),
  sincronizado_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT mercadolibre_catalogo_vehiculo_atributo_check CHECK (atributo_id IN (
    'BRAND', 'MODEL', 'VEHICLE_YEAR', 'SHORT_VERSION', 'ENGINE',
    'FUEL_TYPE', 'POWER', 'VEHICLE_BODY_TYPE', 'TRANSMISSION_CONTROL_TYPE',
    'GEAR_NUMBER', 'DOORS', 'STEERING', 'TRACTION_CONTROL', 'VALVES_PER_CYLINDER'
  )),
  CONSTRAINT mercadolibre_catalogo_vehiculo_valor_unique
    UNIQUE (dominio_id, atributo_id, valor_id, contexto_clave)
);

CREATE INDEX IF NOT EXISTS idx_ml_catalogo_vehiculo_valor_busqueda
  ON public.mercadolibre_catalogo_vehiculo_valor (dominio_id, atributo_id, contexto_clave, valor_nombre);

CREATE TABLE IF NOT EXISTS public.mercadolibre_catalogo_vehiculo_atributo (
  dominio_id text NOT NULL DEFAULT 'MLA-CARS_AND_VANS',
  atributo_id text NOT NULL,
  habilitado boolean NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (dominio_id, atributo_id)
);

CREATE TABLE IF NOT EXISTS public.mercadolibre_catalogo_vehiculo_sincronizacion (
  dominio_id text PRIMARY KEY DEFAULT 'MLA-CARS_AND_VANS',
  estado text NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'EN_PROCESO', 'COMPLETADA', 'ERROR')),
  siguiente_marca integer NOT NULL DEFAULT 0 CHECK (siguiente_marca >= 0),
  total_marcas integer NOT NULL DEFAULT 0 CHECK (total_marcas >= 0),
  ultimo_error text,
  iniciada_at timestamptz,
  finalizada_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

INSERT INTO public.mercadolibre_catalogo_vehiculo_sincronizacion (dominio_id)
VALUES ('MLA-CARS_AND_VANS')
ON CONFLICT (dominio_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.mercadolibre_pieza_compatibilidad (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_pieza integer NOT NULL REFERENCES public.pieza(id) ON DELETE CASCADE,
  dominio_id text NOT NULL DEFAULT 'MLA-CARS_AND_VANS',
  atributos jsonb NOT NULL,
  firma text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT mercadolibre_pieza_compatibilidad_atributos_array_check CHECK (jsonb_typeof(atributos) = 'array'),
  CONSTRAINT mercadolibre_pieza_compatibilidad_unique UNIQUE (id_pieza, firma)
);

CREATE INDEX IF NOT EXISTS idx_ml_pieza_compatibilidad_pieza
  ON public.mercadolibre_pieza_compatibilidad (id_pieza, created_at DESC);

COMMIT;
