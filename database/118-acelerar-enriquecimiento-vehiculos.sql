BEGIN;

-- Desde ahora el enriquecimiento local consulta solamente los tres datos que
-- usamos para elegir compatibilidades. La transmision se incorporara cuando
-- exista una fuente estable para obtenerla en el catalogo masivo de Mercado
-- Libre.
ALTER TABLE public.mercadolibre_catalogo_vehiculo_enriquecimiento_cola
  DROP CONSTRAINT IF EXISTS mercadolibre_catalogo_vehiculo_enriquecimiento_cola_siguiente_atributo_id_check;

-- La cola anterior conserva etapas que ya no existen. No se tocan los
-- vehiculos canonicos ni las compatibilidades asignadas a piezas.
DELETE FROM public.mercadolibre_catalogo_vehiculo_enriquecimiento_cola
WHERE dominio_id = 'MLA-CARS_AND_VANS';

ALTER TABLE public.mercadolibre_catalogo_vehiculo_enriquecimiento_cola
  ADD CONSTRAINT mercadolibre_catalogo_vehiculo_enriquecimiento_cola_siguiente_atributo_id_check
  CHECK (siguiente_atributo_id IN (
    'SHORT_VERSION', 'FUEL_TYPE', 'VALVES_PER_CYLINDER', 'SAVE'
  ));

-- Una aplicacion ya esta detallada para esta estrategia si tiene los tres
-- valores objetivo. Las demas vuelven a empezar desde la base marca/modelo/
-- anio/motor/potencia, sin arrastrar atributos descartados de la ruta vieja.
UPDATE public.mercadolibre_catalogo_vehiculo
SET estado = CASE
      WHEN version_id IS NOT NULL
       AND combustible_id IS NOT NULL
       AND valvulas_por_cilindro_id IS NOT NULL THEN 'DETALLADO'
      ELSE 'BASE'
    END,
    sincronizado_at = NOW()
WHERE dominio_id = 'MLA-CARS_AND_VANS';

WITH candidatas AS (
  SELECT DISTINCT ON (vehiculo.marca_id, vehiculo.modelo_id, vehiculo.anio_id, vehiculo.motor_id, vehiculo.potencia_id)
    vehiculo.id AS id_vehiculo_base,
    vehiculo.dominio_id,
    base.atributos,
    base.firma
  FROM public.mercadolibre_catalogo_vehiculo AS vehiculo
  CROSS JOIN LATERAL (
    SELECT
      jsonb_agg(atributo ORDER BY atributo->>'id') AS atributos,
      string_agg(
        (atributo->>'id') || ':' || (atributo->>'valueId'),
        '|' ORDER BY atributo->>'id'
      ) AS firma
    FROM jsonb_array_elements(vehiculo.atributos) AS atributo
    WHERE atributo->>'id' IN ('BRAND', 'MODEL', 'VEHICLE_YEAR', 'ENGINE', 'POWER')
  ) AS base
  WHERE vehiculo.dominio_id = 'MLA-CARS_AND_VANS'
    AND vehiculo.activa = TRUE
    AND base.atributos IS NOT NULL
    AND (
      vehiculo.version_id IS NULL
      OR vehiculo.combustible_id IS NULL
      OR vehiculo.valvulas_por_cilindro_id IS NULL
    )
  ORDER BY vehiculo.marca_id, vehiculo.modelo_id, vehiculo.anio_id, vehiculo.motor_id, vehiculo.potencia_id, vehiculo.id
)
INSERT INTO public.mercadolibre_catalogo_vehiculo_enriquecimiento_cola (
  dominio_id, id_vehiculo_base, atributos, firma, siguiente_atributo_id,
  prioridad, estado, intentos, ultimo_error, created_at, updated_at
)
SELECT
  dominio_id, id_vehiculo_base, atributos, firma, 'SHORT_VERSION',
  1, 'PENDIENTE', 0, NULL, NOW(), NOW()
FROM candidatas;

COMMIT;
