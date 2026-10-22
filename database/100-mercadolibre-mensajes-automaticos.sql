CREATE TABLE IF NOT EXISTS public.mercadolibre_mensaje_automatico_config (
  id_cuenta BIGINT PRIMARY KEY REFERENCES public.mercadolibre_cuenta(id),
  activo BOOLEAN NOT NULL DEFAULT FALSE,
  texto TEXT NOT NULL,
  activado_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.mercadolibre_mensaje_automatico_evento (
  id_cuenta BIGINT NOT NULL REFERENCES public.mercadolibre_cuenta(id),
  venta_id TEXT NOT NULL,
  estado TEXT NOT NULL,
  detalle TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id_cuenta, venta_id)
);
