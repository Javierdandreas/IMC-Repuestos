BEGIN;

CREATE TABLE IF NOT EXISTS public.proveedor_cotizacion_configuracion (
  id_proveedor integer NOT NULL REFERENCES public.proveedores(id) ON DELETE CASCADE,
  codigo text NOT NULL REFERENCES public.moneda_cotizacion_configuracion(codigo),
  lado text NOT NULL CHECK (lado IN ('COMPRA', 'VENTA')),
  tipo_recargo text NOT NULL CHECK (tipo_recargo IN ('PORCENTAJE', 'MONTO_FIJO')),
  recargo numeric NOT NULL DEFAULT 0 CHECK (recargo >= 0),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id_proveedor, codigo)
);

INSERT INTO public.proveedor_cotizacion_configuracion (id_proveedor, codigo, lado, tipo_recargo, recargo)
SELECT legacy.id_proveedor, quote.codigo, legacy.lado, legacy.tipo_recargo, legacy.recargo
FROM public.proveedor_moneda_configuracion legacy
JOIN public.moneda_cotizacion_configuracion quote
  ON quote.moneda = legacy.moneda AND quote.referencia = legacy.referencia
WHERE legacy.moneda <> 'ARS'
ON CONFLICT (id_proveedor, codigo) DO NOTHING;

COMMIT;
