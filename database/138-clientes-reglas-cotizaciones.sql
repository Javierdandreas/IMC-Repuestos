BEGIN;

CREATE TABLE IF NOT EXISTS public.cliente_regla_descuento (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_cliente integer NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  id_marca integer REFERENCES public.marcas(id) ON DELETE RESTRICT,
  id_categoria integer REFERENCES public.categoria(id) ON DELETE RESTRICT,
  id_subcategoria integer REFERENCES public.subcategoria(id) ON DELETE RESTRICT,
  descuento numeric(7,2) NOT NULL CHECK (descuento BETWEEN 0 AND 100),
  CHECK (id_marca IS NOT NULL OR id_categoria IS NOT NULL OR id_subcategoria IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS cliente_regla_descuento_alcance_unique
  ON public.cliente_regla_descuento (id_cliente, COALESCE(id_marca, 0), COALESCE(id_categoria, 0), COALESCE(id_subcategoria, 0));

INSERT INTO public.cliente_regla_descuento (id_cliente, id_marca, descuento)
SELECT id_cliente, id_marca, descuento FROM public.cliente_descuento_marca
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.partner_cotizacion (
  id uuid PRIMARY KEY,
  id_cliente integer NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  respuesta jsonb NOT NULL,
  calculo_interno jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS partner_cotizacion_cliente_fecha_idx ON public.partner_cotizacion (id_cliente, created_at DESC);

CREATE TABLE IF NOT EXISTS public.cliente_condiciones_historial (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_cliente integer NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  condiciones jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS cliente_condiciones_historial_cliente_idx
  ON public.cliente_condiciones_historial (id_cliente, id DESC);

-- Solo el servidor accede a condiciones privadas y auditorias mediante PostgreSQL.
ALTER TABLE public.cliente_regla_descuento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_cotizacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cliente_condiciones_historial ENABLE ROW LEVEL SECURITY;

COMMIT;
