-- Vincula publicaciones ya sincronizadas cuando se crea o modifica un codigo local.
-- Los vinculos MANUAL y EXCLUIDO_MANUAL no se modifican.

CREATE INDEX IF NOT EXISTS idx_mercadolibre_publicacion_sku_sin_vinculo_normalizado
  ON public.mercadolibre_publicacion (
    regexp_replace(upper(trim(seller_sku)), '[^A-Z0-9]+', '', 'g')
  )
  WHERE seller_sku IS NOT NULL AND tipo_vinculo = 'SIN_VINCULO';

CREATE OR REPLACE FUNCTION public.vincular_publicaciones_ml_producto()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    UPDATE public.mercadolibre_publicacion
    SET id_producto = NULL, id_kit = NULL, tipo_vinculo = 'SIN_VINCULO', updated_at = NOW()
    WHERE id_producto = OLD.id
      AND tipo_vinculo = 'CODIGO_EXACTO'
      AND (
        COALESCE(NEW.oculto_por_kit, FALSE)
        OR regexp_replace(upper(trim(COALESCE(seller_sku, ''))), '[^A-Z0-9]+', '', 'g')
           <> regexp_replace(upper(trim(NEW.cod_unico)), '[^A-Z0-9]+', '', 'g')
      );
  END IF;

  IF COALESCE(NEW.oculto_por_kit, FALSE) THEN RETURN NEW; END IF;
  IF EXISTS (
    SELECT 1 FROM public.kits
    WHERE COALESCE(activo, TRUE)
      AND regexp_replace(upper(trim(codigo_kit)), '[^A-Z0-9]+', '', 'g')
          = regexp_replace(upper(trim(NEW.cod_unico)), '[^A-Z0-9]+', '', 'g')
  ) THEN RETURN NEW; END IF;
  IF (SELECT COUNT(*) FROM public.productos
      WHERE NOT COALESCE(oculto_por_kit, FALSE)
        AND regexp_replace(upper(trim(cod_unico)), '[^A-Z0-9]+', '', 'g')
            = regexp_replace(upper(trim(NEW.cod_unico)), '[^A-Z0-9]+', '', 'g')) <> 1 THEN RETURN NEW; END IF;

  UPDATE public.mercadolibre_publicacion
  SET id_producto = NEW.id, id_kit = NULL, tipo_vinculo = 'CODIGO_EXACTO', updated_at = NOW()
  WHERE id_producto IS NULL AND id_kit IS NULL AND tipo_vinculo = 'SIN_VINCULO'
    AND regexp_replace(upper(trim(COALESCE(seller_sku, ''))), '[^A-Z0-9]+', '', 'g')
        = regexp_replace(upper(trim(NEW.cod_unico)), '[^A-Z0-9]+', '', 'g');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.vincular_publicaciones_ml_kit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    UPDATE public.mercadolibre_publicacion
    SET id_producto = NULL, id_kit = NULL, tipo_vinculo = 'SIN_VINCULO', updated_at = NOW()
    WHERE id_kit = OLD.id
      AND tipo_vinculo = 'CODIGO_EXACTO'
      AND (
        NOT COALESCE(NEW.activo, TRUE)
        OR regexp_replace(upper(trim(COALESCE(seller_sku, ''))), '[^A-Z0-9]+', '', 'g')
           <> regexp_replace(upper(trim(NEW.codigo_kit)), '[^A-Z0-9]+', '', 'g')
      );
  END IF;

  IF NOT COALESCE(NEW.activo, TRUE) THEN RETURN NEW; END IF;
  IF EXISTS (
    SELECT 1 FROM public.productos
    WHERE NOT COALESCE(oculto_por_kit, FALSE)
      AND regexp_replace(upper(trim(cod_unico)), '[^A-Z0-9]+', '', 'g')
          = regexp_replace(upper(trim(NEW.codigo_kit)), '[^A-Z0-9]+', '', 'g')
  ) THEN RETURN NEW; END IF;

  UPDATE public.mercadolibre_publicacion
  SET id_producto = NULL, id_kit = NEW.id, tipo_vinculo = 'CODIGO_EXACTO', updated_at = NOW()
  WHERE id_producto IS NULL AND id_kit IS NULL AND tipo_vinculo = 'SIN_VINCULO'
    AND regexp_replace(upper(trim(COALESCE(seller_sku, ''))), '[^A-Z0-9]+', '', 'g')
        = regexp_replace(upper(trim(NEW.codigo_kit)), '[^A-Z0-9]+', '', 'g');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vincular_publicaciones_ml_producto ON public.productos;
CREATE TRIGGER trg_vincular_publicaciones_ml_producto
AFTER INSERT OR UPDATE OF cod_unico, oculto_por_kit ON public.productos
FOR EACH ROW EXECUTE FUNCTION public.vincular_publicaciones_ml_producto();

DROP TRIGGER IF EXISTS trg_vincular_publicaciones_ml_kit ON public.kits;
CREATE TRIGGER trg_vincular_publicaciones_ml_kit
AFTER INSERT OR UPDATE OF codigo_kit, activo ON public.kits
FOR EACH ROW EXECUTE FUNCTION public.vincular_publicaciones_ml_kit();
