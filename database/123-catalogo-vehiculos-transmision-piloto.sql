BEGIN;

-- La primera prueba completa solamente la transmision de Mercedes-Benz Clase
-- GLK. No borra vehiculos ni compatibilidades existentes; las nuevas variantes
-- quedan como registros mas especificos del mismo catalogo.
ALTER TABLE public.mercadolibre_catalogo_vehiculo_enriquecimiento_cola
  DROP CONSTRAINT IF EXISTS mercadolibre_catalogo_vehiculo_enriquecimiento_cola_siguiente_atributo_id_check;

ALTER TABLE public.mercadolibre_catalogo_vehiculo_enriquecimiento_cola
  ADD CONSTRAINT mercadolibre_catalogo_vehiculo_enriquecimiento_cola_siguiente_atributo_id_check
  CHECK (siguiente_atributo_id IN (
    'SHORT_VERSION', 'FUEL_TYPE', 'VALVES_PER_CYLINDER',
    'TRANSMISSION_CONTROL_TYPE', 'SAVE'
  ));

INSERT INTO public.mercadolibre_catalogo_vehiculo_enriquecimiento_cola (
  dominio_id, id_vehiculo_base, atributos, firma, siguiente_atributo_id,
  prioridad, estado, intentos, ultimo_error, created_at, updated_at
)
SELECT
  vehiculo.dominio_id,
  vehiculo.id,
  vehiculo.atributos,
  vehiculo.firma,
  'TRANSMISSION_CONTROL_TYPE',
  1000,
  'PENDIENTE',
  0,
  NULL,
  NOW(),
  NOW()
FROM public.mercadolibre_catalogo_vehiculo AS vehiculo
WHERE vehiculo.dominio_id = 'MLA-CARS_AND_VANS'
  AND vehiculo.activa = TRUE
  AND vehiculo.estado = 'DETALLADO'
  AND vehiculo.marca_id = '75966'
  AND vehiculo.modelo_id = '503632'
  AND vehiculo.transmision_id IS NULL
ON CONFLICT (dominio_id, firma, siguiente_atributo_id) DO UPDATE
SET estado = CASE
      WHEN mercadolibre_catalogo_vehiculo_enriquecimiento_cola.estado = 'ERROR' THEN 'PENDIENTE'
      ELSE mercadolibre_catalogo_vehiculo_enriquecimiento_cola.estado
    END,
    ultimo_error = CASE
      WHEN mercadolibre_catalogo_vehiculo_enriquecimiento_cola.estado = 'ERROR' THEN NULL
      ELSE mercadolibre_catalogo_vehiculo_enriquecimiento_cola.ultimo_error
    END,
    prioridad = GREATEST(mercadolibre_catalogo_vehiculo_enriquecimiento_cola.prioridad, EXCLUDED.prioridad),
    updated_at = NOW();

COMMIT;
