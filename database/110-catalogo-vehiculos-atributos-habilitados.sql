BEGIN;

CREATE TABLE IF NOT EXISTS public.mercadolibre_catalogo_vehiculo_atributo (
  dominio_id text NOT NULL DEFAULT 'MLA-CARS_AND_VANS',
  atributo_id text NOT NULL,
  habilitado boolean NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (dominio_id, atributo_id)
);

COMMIT;
