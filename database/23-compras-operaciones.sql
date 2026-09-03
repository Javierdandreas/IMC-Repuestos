BEGIN;

ALTER TABLE public.operacion
  ADD COLUMN IF NOT EXISTS id_proveedor integer,
  ADD COLUMN IF NOT EXISTS fecha_operacion date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS tipo_comprobante character varying,
  ADD COLUMN IF NOT EXISTS moneda character varying NOT NULL DEFAULT 'ARS',
  ADD COLUMN IF NOT EXISTS estado character varying NOT NULL DEFAULT 'CONFIRMADA',
  ADD COLUMN IF NOT EXISTS actualiza_costo_proveedor boolean NOT NULL DEFAULT false;

ALTER TABLE public.operacion
  DROP CONSTRAINT IF EXISTS operacion_id_proveedor_fkey;

ALTER TABLE public.operacion
  ADD CONSTRAINT operacion_id_proveedor_fkey
  FOREIGN KEY (id_proveedor) REFERENCES public.proveedores(id) ON DELETE RESTRICT;

ALTER TABLE public.operacion
  DROP CONSTRAINT IF EXISTS operacion_estado_check;

ALTER TABLE public.operacion
  ADD CONSTRAINT operacion_estado_check
  CHECK (upper(trim(estado)) = ANY (ARRAY['BORRADOR', 'CONFIRMADA', 'ANULADA']));

ALTER TABLE public.operacion
  DROP CONSTRAINT IF EXISTS operacion_moneda_check;

ALTER TABLE public.operacion
  ADD CONSTRAINT operacion_moneda_check
  CHECK (moneda = 'ARS');

ALTER TABLE public.operacion_detalle
  ADD COLUMN IF NOT EXISTS codigo_proveedor character varying,
  ADD COLUMN IF NOT EXISTS descuento_porcentaje numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS iva_porcentaje numeric NOT NULL DEFAULT 0;

ALTER TABLE public.operacion_detalle
  DROP CONSTRAINT IF EXISTS operacion_detalle_descuento_check;

ALTER TABLE public.operacion_detalle
  ADD CONSTRAINT operacion_detalle_descuento_check
  CHECK (descuento_porcentaje >= 0 AND descuento_porcentaje <= 100);

ALTER TABLE public.operacion_detalle
  DROP CONSTRAINT IF EXISTS operacion_detalle_iva_check;

ALTER TABLE public.operacion_detalle
  ADD CONSTRAINT operacion_detalle_iva_check
  CHECK (iva_porcentaje >= 0 AND iva_porcentaje <= 100);

CREATE INDEX IF NOT EXISTS idx_operacion_proveedor_fecha
  ON public.operacion (id_proveedor, fecha_operacion DESC);

CREATE INDEX IF NOT EXISTS idx_operacion_tipo_estado_fecha
  ON public.operacion (tipo, estado, fecha_operacion DESC);

COMMIT;
