CREATE TABLE IF NOT EXISTS public.mercadolibre_mensaje_prueba (
  id BIGSERIAL PRIMARY KEY,
  id_cuenta BIGINT NOT NULL REFERENCES public.mercadolibre_cuenta(id),
  pack_id TEXT NOT NULL,
  venta_id TEXT NOT NULL,
  texto TEXT NOT NULL,
  estado TEXT NOT NULL,
  detalle TEXT,
  mensaje_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id_cuenta, pack_id)
);
