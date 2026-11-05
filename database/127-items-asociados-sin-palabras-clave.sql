-- Las palabras clave solo sirven para items que todavia no tienen un item
-- asociado. La pieza vinculada pasa a ser la fuente canonica de busqueda.
UPDATE public.productos
SET palabra_clave = NULL
WHERE id_pieza IS NOT NULL
  AND palabra_clave IS NOT NULL;

CREATE OR REPLACE FUNCTION public.limpiar_palabra_clave_item_asociado()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.id_pieza IS NOT NULL THEN
    NEW.palabra_clave := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_productos_limpiar_palabra_clave_item_asociado ON public.productos;

CREATE TRIGGER trg_productos_limpiar_palabra_clave_item_asociado
BEFORE INSERT OR UPDATE OF id_pieza, palabra_clave ON public.productos
FOR EACH ROW
EXECUTE FUNCTION public.limpiar_palabra_clave_item_asociado();
