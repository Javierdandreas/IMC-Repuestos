CREATE TABLE IF NOT EXISTS public.catalogo_externo_sincronizacion (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  origen text NOT NULL DEFAULT 'GESU_EXTERNO',
  sync_run_id text NOT NULL,
  fecha_origen timestamptz,
  consultado_at timestamptz NOT NULL DEFAULT NOW(),
  total_registros integer NOT NULL DEFAULT 0,
  ignorados jsonb NOT NULL DEFAULT '[]'::jsonb,
  errores jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_count integer NOT NULL DEFAULT 0,
  CONSTRAINT catalogo_externo_sincronizacion_origen_run_unique UNIQUE (origen, sync_run_id)
);

CREATE TABLE IF NOT EXISTS public.catalogo_externo_item (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_sincronizacion integer NOT NULL REFERENCES public.catalogo_externo_sincronizacion(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  source_row_id text,
  tipo text NOT NULL CHECK (tipo IN ('PRODUCTO', 'GRUPO')),
  codigo text NOT NULL,
  titulo text NOT NULL,
  descripcion text NOT NULL,
  marca text,
  categoria text,
  subcategoria text,
  codigo_barras text,
  palabras_clave text,
  stock integer NOT NULL DEFAULT 0,
  ubicacion text,
  proveedor text,
  codigo_proveedor text,
  estado_clasificacion text NOT NULL CHECK (estado_clasificacion IN ('LISTA', 'REVISAR', 'SIN_DATOS')),
  id_subcategoria integer REFERENCES public.subcategoria(id),
  id_marca integer REFERENCES public.marcas(id),
  existe_local boolean NOT NULL DEFAULT false,
  id_producto_local integer REFERENCES public.productos(id),
  componentes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT catalogo_externo_item_sincronizacion_externo_unique UNIQUE (id_sincronizacion, external_id)
);

ALTER TABLE public.catalogo_externo_item
  ADD COLUMN IF NOT EXISTS stock integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ubicacion text,
  ADD COLUMN IF NOT EXISTS proveedor text,
  ADD COLUMN IF NOT EXISTS codigo_proveedor text;

CREATE INDEX IF NOT EXISTS idx_catalogo_externo_item_revision
  ON public.catalogo_externo_item (id_sincronizacion, tipo, existe_local, estado_clasificacion, codigo);

CREATE TABLE IF NOT EXISTS public.catalogo_externo_clasificacion (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  origen text NOT NULL DEFAULT 'GESU_EXTERNO',
  codigo_externo text NOT NULL,
  id_subcategoria integer NOT NULL REFERENCES public.subcategoria(id),
  usuario_id integer REFERENCES public.usuario(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT catalogo_externo_clasificacion_origen_codigo_unique UNIQUE (origen, codigo_externo)
);

CREATE INDEX IF NOT EXISTS idx_catalogo_externo_clasificacion_subcategoria
  ON public.catalogo_externo_clasificacion (id_subcategoria);

CREATE TABLE IF NOT EXISTS public.catalogo_externo_kit_componentes (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  origen text NOT NULL DEFAULT 'GESU_EXTERNO',
  codigo_kit text NOT NULL,
  componentes jsonb NOT NULL DEFAULT '[]'::jsonb,
  usuario_id integer REFERENCES public.usuario(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT catalogo_externo_kit_componentes_origen_codigo_unique UNIQUE (origen, codigo_kit)
);

CREATE TABLE IF NOT EXISTS public.kit_origen_externo (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_kit integer NOT NULL REFERENCES public.kits(id) ON DELETE CASCADE,
  origen text NOT NULL DEFAULT 'GESU_EXTERNO',
  external_id text NOT NULL,
  codigo_externo text NOT NULL,
  sync_run_id text,
  fecha_sincronizacion timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT kit_origen_externo_origen_externo_unique UNIQUE (origen, external_id)
);

CREATE INDEX IF NOT EXISTS idx_kit_origen_externo_kit
  ON public.kit_origen_externo (id_kit);

CREATE TABLE IF NOT EXISTS public.producto_origen_externo (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_producto integer NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  origen text NOT NULL DEFAULT 'GESU_EXTERNO',
  external_id text NOT NULL,
  codigo_externo text NOT NULL,
  sync_run_id text,
  fecha_sincronizacion timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT producto_origen_externo_origen_externo_unique UNIQUE (origen, external_id)
);

CREATE INDEX IF NOT EXISTS idx_producto_origen_externo_producto
  ON public.producto_origen_externo (id_producto);
