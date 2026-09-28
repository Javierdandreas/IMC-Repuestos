BEGIN;

CREATE TABLE IF NOT EXISTS public.proveedor_stock_color_regla (
  id bigserial PRIMARY KEY,
  id_proveedor integer NOT NULL REFERENCES public.proveedores(id) ON DELETE CASCADE,
  color text NOT NULL,
  estado text NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT NOW(),
  updated_at timestamp with time zone NOT NULL DEFAULT NOW(),
  CONSTRAINT proveedor_stock_color_regla_color_check
    CHECK (color = 'SIN_COLOR' OR color ~ '^[A-F0-9]{6}$'),
  CONSTRAINT proveedor_stock_color_regla_estado_check
    CHECK (estado IN ('DISPONIBLE', 'PROXIMO_INGRESO', 'SIN_STOCK', 'DESCONOCIDO')),
  CONSTRAINT proveedor_stock_color_regla_unique UNIQUE (id_proveedor, color)
);

CREATE INDEX IF NOT EXISTS idx_proveedor_stock_color_regla_proveedor
  ON public.proveedor_stock_color_regla (id_proveedor, activo);

COMMIT;
