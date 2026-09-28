BEGIN;

CREATE TABLE IF NOT EXISTS public.proveedor_regla_costo (
  id bigserial PRIMARY KEY,
  id_proveedor integer NOT NULL REFERENCES public.proveedores(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  alcance text NOT NULL DEFAULT 'GENERAL',
  id_marca integer REFERENCES public.marcas(id) ON DELETE CASCADE,
  tipo_ajuste text NOT NULL,
  valor numeric NOT NULL,
  orden integer NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT NOW(),
  updated_at timestamp with time zone NOT NULL DEFAULT NOW(),
  CONSTRAINT proveedor_regla_costo_alcance_check
    CHECK (alcance IN ('GENERAL', 'MARCA')),
  CONSTRAINT proveedor_regla_costo_alcance_marca_check
    CHECK (
      (alcance = 'GENERAL' AND id_marca IS NULL)
      OR (alcance = 'MARCA' AND id_marca IS NOT NULL)
    ),
  CONSTRAINT proveedor_regla_costo_tipo_check
    CHECK (tipo_ajuste IN (
      'COEFICIENTE',
      'QUITAR_IVA',
      'DESCUENTO_PORCENTUAL',
      'RECARGO_PORCENTUAL',
      'DESCUENTO_FIJO',
      'RECARGO_FIJO'
    )),
  CONSTRAINT proveedor_regla_costo_valor_check
    CHECK (
      valor >= 0
      AND (tipo_ajuste NOT IN ('COEFICIENTE', 'QUITAR_IVA') OR valor > 0)
    ),
  CONSTRAINT proveedor_regla_costo_orden_check CHECK (orden >= 0)
);

CREATE INDEX IF NOT EXISTS idx_proveedor_regla_costo_aplicacion
  ON public.proveedor_regla_costo (id_proveedor, activo, orden, id);

-- Conserva las condiciones ya cargadas en el formato anterior.
INSERT INTO public.proveedor_regla_costo (
  id_proveedor, nombre, alcance, id_marca, tipo_ajuste, valor, orden, activo
)
SELECT
  proveedor.id,
  'Descuento general',
  'GENERAL',
  NULL,
  'DESCUENTO_PORCENTUAL',
  proveedor.descuento_general,
  20,
  true
FROM public.proveedores proveedor
WHERE COALESCE(proveedor.descuento_general, 0) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM public.proveedor_regla_costo regla
    WHERE regla.id_proveedor = proveedor.id
      AND regla.nombre = 'Descuento general'
  );

INSERT INTO public.proveedor_regla_costo (
  id_proveedor, nombre, alcance, id_marca, tipo_ajuste, valor, orden, activo
)
SELECT
  descuento.id_proveedor,
  'Coeficiente por marca',
  'MARCA',
  descuento.id_marca,
  'COEFICIENTE',
  descuento.coeficiente,
  10,
  true
FROM public.proveedor_descuento_marca descuento
WHERE COALESCE(descuento.coeficiente, 1) <> 1
  AND NOT EXISTS (
    SELECT 1
    FROM public.proveedor_regla_costo regla
    WHERE regla.id_proveedor = descuento.id_proveedor
      AND regla.id_marca = descuento.id_marca
      AND regla.nombre = 'Coeficiente por marca'
  );

INSERT INTO public.proveedor_regla_costo (
  id_proveedor, nombre, alcance, id_marca, tipo_ajuste, valor, orden, activo
)
SELECT
  descuento.id_proveedor,
  'Descuento por marca',
  'MARCA',
  descuento.id_marca,
  'DESCUENTO_PORCENTUAL',
  descuento.descuento,
  30,
  true
FROM public.proveedor_descuento_marca descuento
WHERE COALESCE(descuento.descuento, 0) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM public.proveedor_regla_costo regla
    WHERE regla.id_proveedor = descuento.id_proveedor
      AND regla.id_marca = descuento.id_marca
      AND regla.nombre = 'Descuento por marca'
  );

COMMIT;
