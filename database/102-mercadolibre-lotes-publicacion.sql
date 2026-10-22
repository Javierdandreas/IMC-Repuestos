CREATE TABLE IF NOT EXISTS public.mercadolibre_lote_publicacion (
  id UUID PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('ITEM', 'KIT')),
  producto_id BIGINT NOT NULL,
  publicacion_id BIGINT NOT NULL REFERENCES public.mercadolibre_publicacion(id),
  descripcion TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mercadolibre_lote_publicacion_producto_idx
  ON public.mercadolibre_lote_publicacion (tipo, producto_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.mercadolibre_lote_publicacion_item (
  lote_id UUID NOT NULL REFERENCES public.mercadolibre_lote_publicacion(id),
  posicion INTEGER NOT NULL,
  titulo TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'PENDIENTE',
  resultado JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (lote_id, posicion)
);

CREATE UNIQUE INDEX IF NOT EXISTS mercadolibre_lote_un_item_ejecutando_idx
  ON public.mercadolibre_lote_publicacion_item (lote_id) WHERE estado = 'EJECUTANDO';
