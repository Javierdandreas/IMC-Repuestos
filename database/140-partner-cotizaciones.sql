-- Guarda snapshots de cotizaciones del socio, incluidos los precios Mostrador sin cliente.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE IF NOT EXISTS public.partner_cotizacion (
  id uuid PRIMARY KEY,
  id_cliente integer REFERENCES public.clientes(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  respuesta jsonb NOT NULL,
  calculo_interno jsonb NOT NULL
);

-- La version anterior exigia cliente; una cotizacion Mostrador no tiene uno.
ALTER TABLE public.partner_cotizacion ALTER COLUMN id_cliente DROP NOT NULL;
CREATE INDEX IF NOT EXISTS partner_cotizacion_cliente_fecha_idx
  ON public.partner_cotizacion (id_cliente, created_at DESC);
ALTER TABLE public.partner_cotizacion ENABLE ROW LEVEL SECURITY;

COMMIT;
