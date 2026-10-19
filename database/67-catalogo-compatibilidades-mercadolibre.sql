BEGIN;

CREATE TABLE IF NOT EXISTS public.mercadolibre_compatibilidad_candidata (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_cuenta integer NOT NULL REFERENCES public.mercadolibre_cuenta(id) ON DELETE CASCADE,
  id_pregunta bigint NOT NULL REFERENCES public.mercadolibre_pregunta(id) ON DELETE CASCADE,
  item_id text,
  id_producto integer REFERENCES public.productos(id) ON DELETE SET NULL,
  id_kit integer REFERENCES public.kits(id) ON DELETE SET NULL,
  id_pieza integer REFERENCES public.pieza(id) ON DELETE SET NULL,
  titulo_publicacion text,
  pregunta text NOT NULL,
  respuesta_historica text,
  chasis_detectado text,
  chasis_confirmado text,
  vehiculo text,
  motor text,
  notas text,
  estado text NOT NULL DEFAULT 'PENDIENTE',
  analizado_at timestamptz NOT NULL DEFAULT NOW(),
  revisado_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT mercadolibre_compatibilidad_candidata_estado_check
    CHECK (estado IN ('PENDIENTE', 'CONFIRMADA', 'DESCARTADA')),
  CONSTRAINT mercadolibre_compatibilidad_candidata_cuenta_pregunta_unique
    UNIQUE (id_cuenta, id_pregunta)
);

CREATE INDEX IF NOT EXISTS idx_ml_compatibilidad_candidata_cuenta_estado
  ON public.mercadolibre_compatibilidad_candidata (id_cuenta, estado, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ml_compatibilidad_candidata_pieza
  ON public.mercadolibre_compatibilidad_candidata (id_pieza)
  WHERE id_pieza IS NOT NULL;

COMMIT;
