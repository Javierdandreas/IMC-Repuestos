CREATE TABLE IF NOT EXISTS public.gesu_clientes_sincronizacion (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  pagina_actual integer NOT NULL DEFAULT 1 CHECK (pagina_actual >= 1),
  total_paginas integer,
  ciclo bigint NOT NULL DEFAULT 1,
  ultima_sincronizacion_at timestamptz,
  ultima_sincronizacion_completa_at timestamptz,
  ultimo_error text,
  ejecutando_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.gesu_clientes_sincronizacion (id)
VALUES (true)
ON CONFLICT (id) DO NOTHING;
