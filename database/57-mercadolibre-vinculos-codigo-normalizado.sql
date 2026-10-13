BEGIN;

-- Las publicaciones de Mercado Libre suelen conservar el SKU sin guiones,
-- barras o asteriscos. Estos indices permiten vincularlos con el codigo IMC
-- normalizado sin penalizar la sincronizacion completa.
CREATE INDEX IF NOT EXISTS idx_productos_codigo_ml_normalizado
  ON public.productos (regexp_replace(upper(trim(cod_unico)), '[^A-Z0-9]+', '', 'g'))
  WHERE cod_unico IS NOT NULL AND COALESCE(oculto_por_kit, FALSE) = FALSE;

CREATE INDEX IF NOT EXISTS idx_kits_codigo_ml_normalizado
  ON public.kits (regexp_replace(upper(trim(codigo_kit)), '[^A-Z0-9]+', '', 'g'))
  WHERE codigo_kit IS NOT NULL AND COALESCE(activo, TRUE) = TRUE;

COMMIT;
