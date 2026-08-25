BEGIN;

ALTER TABLE public.producto_serie
  DROP CONSTRAINT IF EXISTS producto_serie_estado_check;

ALTER TABLE public.producto_serie
  ADD CONSTRAINT producto_serie_estado_check
  CHECK (
    upper(trim(estado)) = ANY (
      ARRAY[
        'DISPONIBLE',
        'MOSTRADOR',
        'RESERVADO',
        'VENDIDO',
        'DEVUELTO',
        'GARANTIA',
        'REPARACION',
        'BAJA'
      ]
    )
  );

COMMIT;
