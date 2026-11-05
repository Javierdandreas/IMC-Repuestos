BEGIN;

-- Encola la ampliacion global con los atributos disponibles en Mercado Libre.
-- Las tareas ya completadas (por ejemplo, el piloto GLK) no se repiten.
INSERT INTO public.mercadolibre_catalogo_vehiculo_enriquecimiento_cola (
  dominio_id, id_vehiculo_base, atributos, firma, siguiente_atributo_id,
  prioridad, estado, intentos, ultimo_error, created_at, updated_at
)
SELECT
  vehiculo.dominio_id,
  vehiculo.id,
  vehiculo.atributos,
  vehiculo.firma,
  'VEHICLE_BODY_TYPE',
  10,
  'PENDIENTE',
  0,
  NULL,
  NOW(),
  NOW()
FROM public.mercadolibre_catalogo_vehiculo AS vehiculo
WHERE vehiculo.dominio_id = 'MLA-CARS_AND_VANS'
  AND vehiculo.activa = TRUE
  AND vehiculo.estado = 'DETALLADO'
  AND vehiculo.carroceria_id IS NULL
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
