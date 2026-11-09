-- El selector de compatibilidades descarta rutas menos especificas mediante
-- contencion JSON. Este indice evita comparar cada vehiculo contra toda la tabla.
CREATE INDEX IF NOT EXISTS idx_ml_catalogo_vehiculo_atributos_activos_gin
  ON public.mercadolibre_catalogo_vehiculo
  USING GIN (atributos jsonb_path_ops)
  WHERE activa = TRUE;
