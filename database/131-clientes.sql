CREATE TABLE IF NOT EXISTS public.clientes (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  gesu_id bigint UNIQUE,
  razon_social text NOT NULL,
  tipo_persona text NOT NULL DEFAULT 'FISICA' CHECK (tipo_persona IN ('FISICA', 'JURIDICA')),
  tipo_documento text,
  documento text,
  condicion_iva text,
  comprobante_default text,
  domicilio text,
  localidad text,
  provincia text,
  codigo_postal text,
  telefono text,
  celular text,
  email text,
  contacto_nombre text,
  contacto_telefono text,
  contacto_celular text,
  contacto_email text,
  id_tipo_precio integer REFERENCES public.tipo_precio(id) ON DELETE SET NULL,
  bonificacion_general numeric(7, 2) NOT NULL DEFAULT 0 CHECK (bonificacion_general >= 0 AND bonificacion_general <= 100),
  activo boolean NOT NULL DEFAULT true,
  importado_desde_gesu boolean NOT NULL DEFAULT false,
  ultima_sincronizacion_gesu timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clientes_nombre_idx ON public.clientes (razon_social);
CREATE INDEX IF NOT EXISTS clientes_documento_idx ON public.clientes (documento) WHERE documento IS NOT NULL;
CREATE INDEX IF NOT EXISTS clientes_activo_idx ON public.clientes (id) WHERE activo = true;

CREATE TABLE IF NOT EXISTS public.cliente_descuento_marca (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_cliente integer NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  id_marca integer NOT NULL REFERENCES public.marcas(id) ON DELETE RESTRICT,
  descuento numeric(7, 2) NOT NULL CHECK (descuento >= 0 AND descuento <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cliente_descuento_marca_cliente_marca_unique UNIQUE (id_cliente, id_marca)
);

CREATE INDEX IF NOT EXISTS cliente_descuento_marca_cliente_idx ON public.cliente_descuento_marca (id_cliente);
