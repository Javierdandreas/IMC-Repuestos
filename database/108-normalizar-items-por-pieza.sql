BEGIN;

-- Align legacy item records with the canonical data of their assigned piece.
UPDATE public.productos AS producto
SET descripcion = pieza.descripcion,
    id_subcategoria = pieza.id_subcategoria,
    palabra_clave = NULL
FROM public.pieza AS pieza
WHERE producto.id_pieza = pieza.id
  AND (
    producto.descripcion IS DISTINCT FROM pieza.descripcion
    OR producto.id_subcategoria IS DISTINCT FROM pieza.id_subcategoria
    OR producto.palabra_clave IS NOT NULL
  );

COMMIT;
