BEGIN;

CREATE TABLE IF NOT EXISTS public.mercadolibre_cuenta (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  seller_id bigint NOT NULL UNIQUE,
  nickname text,
  site_id text NOT NULL DEFAULT 'MLA',
  scope text,
  access_token_cifrado text NOT NULL,
  refresh_token_cifrado text NOT NULL,
  access_token_expira_at timestamptz NOT NULL,
  conectada boolean NOT NULL DEFAULT true,
  conectada_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  ultima_sincronizacion_at timestamptz,
  ultimo_estado_sincronizacion text,
  ultimo_error_sincronizacion text,
  CONSTRAINT mercadolibre_cuenta_estado_check
    CHECK (ultimo_estado_sincronizacion IS NULL OR ultimo_estado_sincronizacion IN ('OK', 'ERROR', 'EN_PROCESO'))
);

CREATE TABLE IF NOT EXISTS public.mercadolibre_sincronizacion (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_cuenta integer NOT NULL REFERENCES public.mercadolibre_cuenta(id) ON DELETE CASCADE,
  estado text NOT NULL DEFAULT 'EN_PROCESO',
  total_publicaciones integer NOT NULL DEFAULT 0,
  vinculadas_por_codigo integer NOT NULL DEFAULT 0,
  sin_vinculo integer NOT NULL DEFAULT 0,
  errores jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_count integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT NOW(),
  finished_at timestamptz,
  CONSTRAINT mercadolibre_sincronizacion_estado_check CHECK (estado IN ('EN_PROCESO', 'OK', 'ERROR'))
);

CREATE INDEX IF NOT EXISTS idx_mercadolibre_sincronizacion_cuenta_fecha
  ON public.mercadolibre_sincronizacion (id_cuenta, started_at DESC);

CREATE TABLE IF NOT EXISTS public.mercadolibre_publicacion (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_cuenta integer NOT NULL REFERENCES public.mercadolibre_cuenta(id) ON DELETE CASCADE,
  item_id text NOT NULL,
  id_producto integer REFERENCES public.productos(id) ON DELETE SET NULL,
  tipo_vinculo text NOT NULL DEFAULT 'SIN_VINCULO',
  seller_sku text,
  titulo text NOT NULL,
  estado text NOT NULL,
  categoria_id text,
  tipo_publicacion text,
  precio numeric,
  precio_original numeric,
  moneda text,
  cantidad_disponible integer,
  cantidad_vendida integer,
  thumbnail_url text,
  permalink text,
  variaciones jsonb NOT NULL DEFAULT '[]'::jsonb,
  datos jsonb NOT NULL DEFAULT '{}'::jsonb,
  ultima_vez_vista_at timestamptz NOT NULL DEFAULT NOW(),
  sincronizada_at timestamptz NOT NULL DEFAULT NOW(),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT mercadolibre_publicacion_cuenta_item_unique UNIQUE (id_cuenta, item_id),
  CONSTRAINT mercadolibre_publicacion_vinculo_check CHECK (tipo_vinculo IN ('SIN_VINCULO', 'CODIGO_EXACTO', 'MANUAL'))
);

CREATE INDEX IF NOT EXISTS idx_mercadolibre_publicacion_cuenta_estado
  ON public.mercadolibre_publicacion (id_cuenta, estado, ultima_vez_vista_at DESC);

CREATE INDEX IF NOT EXISTS idx_mercadolibre_publicacion_producto
  ON public.mercadolibre_publicacion (id_producto);

COMMIT;
