BEGIN;

-- La carga base solo llega hasta potencia. El detalle se recorre en una cola
-- independiente para no demorar la disponibilidad del catalogo principal.
CREATE TABLE IF NOT EXISTS public.mercadolibre_catalogo_vehiculo_enriquecimiento_cola (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dominio_id text NOT NULL DEFAULT 'MLA-CARS_AND_VANS',
  id_vehiculo_base bigint NOT NULL REFERENCES public.mercadolibre_catalogo_vehiculo(id) ON DELETE CASCADE,
  atributos jsonb NOT NULL,
  firma text NOT NULL,
  siguiente_atributo_id text NOT NULL CHECK (siguiente_atributo_id IN (
    'SHORT_VERSION', 'FUEL_TYPE', 'VEHICLE_BODY_TYPE', 'TRANSMISSION_CONTROL_TYPE',
    'GEAR_NUMBER', 'DOORS', 'STEERING', 'TRACTION_CONTROL', 'VALVES_PER_CYLINDER', 'SAVE'
  )),
  prioridad smallint NOT NULL DEFAULT 0,
  estado text NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'PROCESANDO', 'COMPLETADA', 'ERROR')),
  intentos smallint NOT NULL DEFAULT 0,
  ultimo_error text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT mercadolibre_catalogo_vehiculo_enriquecimiento_atributos_array_check CHECK (jsonb_typeof(atributos) = 'array'),
  CONSTRAINT mercadolibre_catalogo_vehiculo_enriquecimiento_unique UNIQUE (dominio_id, firma, siguiente_atributo_id)
);

CREATE INDEX IF NOT EXISTS idx_ml_catalogo_vehiculo_enriquecimiento_pendiente
  ON public.mercadolibre_catalogo_vehiculo_enriquecimiento_cola (dominio_id, estado, prioridad DESC, id DESC);

-- Se descartan las filas parciales creadas por el recorrido anterior de 14
-- columnas. Las compatibilidades asignadas a piezas se mantienen y la FK se
-- libera automaticamente al borrar los vehiculos canonicos.
DELETE FROM public.mercadolibre_catalogo_vehiculo_enriquecimiento_cola
WHERE dominio_id = 'MLA-CARS_AND_VANS';

DELETE FROM public.mercadolibre_catalogo_vehiculo_cola
WHERE dominio_id = 'MLA-CARS_AND_VANS';

DELETE FROM public.mercadolibre_catalogo_vehiculo_valor
WHERE dominio_id = 'MLA-CARS_AND_VANS';

DELETE FROM public.mercadolibre_catalogo_vehiculo_atributo
WHERE dominio_id = 'MLA-CARS_AND_VANS';

DELETE FROM public.mercadolibre_catalogo_vehiculo
WHERE dominio_id = 'MLA-CARS_AND_VANS';

INSERT INTO public.mercadolibre_catalogo_vehiculo_sincronizacion
  (dominio_id, estado, siguiente_marca, total_marcas, ultimo_error, iniciada_at, finalizada_at, updated_at)
VALUES ('MLA-CARS_AND_VANS', 'PENDIENTE', 0, 51, NULL, NULL, NULL, NOW())
ON CONFLICT (dominio_id) DO UPDATE
SET estado = 'PENDIENTE',
    siguiente_marca = 0,
    total_marcas = 51,
    ultimo_error = NULL,
    iniciada_at = NULL,
    finalizada_at = NULL,
    updated_at = NOW();

COMMIT;
