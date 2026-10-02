CREATE TABLE IF NOT EXISTS public.catalogo_externo_carga_manual (
  lote_id text NOT NULL,
  orden integer NOT NULL,
  fila jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (lote_id, orden)
);

CREATE INDEX IF NOT EXISTS idx_catalogo_externo_carga_manual_created_at
  ON public.catalogo_externo_carga_manual (created_at);
