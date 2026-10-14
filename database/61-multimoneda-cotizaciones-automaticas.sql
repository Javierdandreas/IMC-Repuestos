BEGIN;

CREATE TABLE IF NOT EXISTS public.moneda_cotizacion_configuracion (
  codigo text PRIMARY KEY,
  etiqueta text NOT NULL,
  moneda text NOT NULL CHECK (moneda IN ('ARS', 'USD', 'EUR', 'BRL')),
  referencia text NOT NULL CHECK (referencia IN ('OFICIAL', 'BLUE', 'MEP', 'CCL')),
  origen_api text NOT NULL,
  modo text NOT NULL DEFAULT 'AUTOMATICA' CHECK (modo IN ('MANUAL', 'AUTOMATICA')),
  tipo_recargo text NOT NULL DEFAULT 'PORCENTAJE' CHECK (tipo_recargo IN ('PORCENTAJE', 'MONTO_FIJO')),
  recargo numeric NOT NULL DEFAULT 0 CHECK (recargo >= 0),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

INSERT INTO public.moneda_cotizacion_configuracion (codigo, etiqueta, moneda, referencia, origen_api)
VALUES
  ('USD_BLUE', 'Dolar Blue', 'USD', 'BLUE', 'MONEDAPI_BLUE'),
  ('USD_CCL', 'Dolar Contado con Liqui', 'USD', 'CCL', 'MONEDAPI_CCL'),
  ('USD_MEP', 'Dolar MEP (Bolsa)', 'USD', 'MEP', 'MONEDAPI_BOLSA'),
  ('USD_OFICIAL', 'Dolar Oficial Banco Nacion', 'USD', 'OFICIAL', 'MONEDAPI_BNA'),
  ('EUR_OFICIAL', 'Euro Banco Nacion', 'EUR', 'OFICIAL', 'MONEDAPI_BNA'),
  ('BRL_OFICIAL', 'Real Brasileno Banco Nacion', 'BRL', 'OFICIAL', 'MONEDAPI_BNA')
ON CONFLICT (codigo) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_moneda_cotizacion_configuracion_modo
  ON public.moneda_cotizacion_configuracion (modo, codigo);

COMMIT;
