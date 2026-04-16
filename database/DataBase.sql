-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.categoria (
  id integer NOT NULL DEFAULT nextval('categoria_id_seq'::regclass),
  descripcion character varying NOT NULL,
  CONSTRAINT categoria_pkey PRIMARY KEY (id)
);
CREATE TABLE public.codigo_referencia (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  codigo character varying NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT codigo_referencia_pkey PRIMARY KEY (id)
);
CREATE TABLE public.detalle_usuario (
  id integer NOT NULL,
  nombre character varying,
  apellido character varying,
  email character varying,
  CONSTRAINT detalle_usuario_pkey PRIMARY KEY (id),
  CONSTRAINT detalle_usuario_id_fkey FOREIGN KEY (id) REFERENCES public.usuario(id)
);
CREATE TABLE public.marcas (
  id integer NOT NULL DEFAULT nextval('marcas_id_seq'::regclass),
  descripcion character varying NOT NULL,
  CONSTRAINT marcas_pkey PRIMARY KEY (id)
);
CREATE TABLE public.pieza (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  descripcion character varying NOT NULL,
  id_subcategoria integer NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  codigo_pieza integer NOT NULL DEFAULT nextval('pieza_codigo_pieza_seq'::regclass) UNIQUE,
  imagen_medida_url text,
  medida text,
  CONSTRAINT pieza_pkey PRIMARY KEY (id),
  CONSTRAINT pieza_id_subcategoria_fkey FOREIGN KEY (id_subcategoria) REFERENCES public.subcategoria(id)
);
CREATE TABLE public.pieza_codigo_referencia (
  id_pieza integer NOT NULL,
  id_codigo_referencia integer NOT NULL,
  tipo character varying NOT NULL CHECK (tipo::text = ANY (ARRAY['ORIGINAL'::character varying::text, 'EQUIVALENTE'::character varying::text])),
  observacion character varying,
  CONSTRAINT pieza_codigo_referencia_pkey PRIMARY KEY (id_pieza, id_codigo_referencia, tipo),
  CONSTRAINT pieza_codigo_referencia_id_codigo_referencia_fkey FOREIGN KEY (id_codigo_referencia) REFERENCES public.codigo_referencia(id),
  CONSTRAINT pieza_codigo_referencia_id_pieza_fkey FOREIGN KEY (id_pieza) REFERENCES public.pieza(id)
);
CREATE TABLE public.producto_precio (
  id integer NOT NULL DEFAULT nextval('producto_precio_id_seq'::regclass),
  id_producto integer NOT NULL,
  id_tipo_precio integer NOT NULL,
  precio numeric NOT NULL,
  porcentaje_ganancia numeric,
  CONSTRAINT producto_precio_pkey PRIMARY KEY (id),
  CONSTRAINT producto_precio_id_producto_fkey FOREIGN KEY (id_producto) REFERENCES public.productos(id),
  CONSTRAINT producto_precio_id_tipo_precio_fkey FOREIGN KEY (id_tipo_precio) REFERENCES public.tipo_precio(id)
);
CREATE TABLE public.producto_proveedor (
  id_producto integer NOT NULL,
  id_proveedor integer NOT NULL,
  codigo_proveedor character varying,
  CONSTRAINT producto_proveedor_pkey PRIMARY KEY (id_producto, id_proveedor),
  CONSTRAINT producto_proveedor_id_producto_fkey FOREIGN KEY (id_producto) REFERENCES public.productos(id),
  CONSTRAINT producto_proveedor_id_proveedor_fkey FOREIGN KEY (id_proveedor) REFERENCES public.proveedores(id)
);
CREATE TABLE public.producto_serie (
  id bigint NOT NULL DEFAULT nextval('producto_serie_id_seq'::regclass),
  id_producto integer NOT NULL,
  numero_serie character varying NOT NULL UNIQUE CHECK (length(TRIM(BOTH FROM numero_serie)) > 0),
  estado character varying NOT NULL DEFAULT 'DISPONIBLE'::character varying CHECK (upper(TRIM(BOTH FROM estado)) = ANY (ARRAY['DISPONIBLE'::text, 'RESERVADO'::text, 'VENDIDO'::text, 'DEVUELTO'::text, 'GARANTIA'::text, 'REPARACION'::text, 'BAJA'::text])),
  id_ubicacion integer,
  fecha_ingreso timestamp with time zone NOT NULL DEFAULT now(),
  fecha_venta timestamp with time zone,
  costo_unitario numeric,
  observacion text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT producto_serie_pkey PRIMARY KEY (id),
  CONSTRAINT producto_serie_id_producto_fkey FOREIGN KEY (id_producto) REFERENCES public.productos(id),
  CONSTRAINT producto_serie_id_ubicacion_fkey FOREIGN KEY (id_ubicacion) REFERENCES public.ubicaciones(id)
);
CREATE TABLE public.producto_serie_movimiento (
  id bigint NOT NULL DEFAULT nextval('producto_serie_movimiento_id_seq'::regclass),
  id_producto_serie bigint NOT NULL,
  tipo character varying NOT NULL CHECK (upper(TRIM(BOTH FROM tipo)) = ANY (ARRAY['INGRESO'::text, 'TRANSFERENCIA'::text, 'RESERVA'::text, 'VENTA'::text, 'DEVOLUCION'::text, 'GARANTIA'::text, 'REPARACION'::text, 'BAJA'::text])),
  id_ubicacion_origen integer,
  id_ubicacion_destino integer,
  referencia character varying,
  observacion text,
  usuario_id integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT producto_serie_movimiento_pkey PRIMARY KEY (id),
  CONSTRAINT producto_serie_movimiento_id_producto_serie_fkey FOREIGN KEY (id_producto_serie) REFERENCES public.producto_serie(id),
  CONSTRAINT producto_serie_movimiento_id_ubicacion_origen_fkey FOREIGN KEY (id_ubicacion_origen) REFERENCES public.ubicaciones(id),
  CONSTRAINT producto_serie_movimiento_id_ubicacion_destino_fkey FOREIGN KEY (id_ubicacion_destino) REFERENCES public.ubicaciones(id),
  CONSTRAINT producto_serie_movimiento_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id)
);
CREATE TABLE public.productos (
  id integer NOT NULL DEFAULT nextval('productos_id_seq'::regclass),
  descripcion character varying NOT NULL,
  cod_barra character varying,
  stock integer DEFAULT 0,
  id_subcategoria integer NOT NULL,
  id_marca integer,
  cod_unico character varying,
  id_pieza integer NOT NULL,
  imagen_url text,
  id_ubicacion integer,
  alegra_id character varying,
  usa_numero_serie boolean NOT NULL DEFAULT false,
  CONSTRAINT productos_pkey PRIMARY KEY (id),
  CONSTRAINT productos_id_marca_fkey FOREIGN KEY (id_marca) REFERENCES public.marcas(id),
  CONSTRAINT productos_id_pieza_fkey FOREIGN KEY (id_pieza) REFERENCES public.pieza(id),
  CONSTRAINT productos_id_subcategoria_fkey FOREIGN KEY (id_subcategoria) REFERENCES public.subcategoria(id),
  CONSTRAINT productos_id_ubicacion_fkey FOREIGN KEY (id_ubicacion) REFERENCES public.ubicaciones(id)
);
CREATE TABLE public.proveedores (
  id integer NOT NULL DEFAULT nextval('proveedores_id_seq'::regclass),
  descripcion character varying NOT NULL,
  CONSTRAINT proveedores_pkey PRIMARY KEY (id)
);
CREATE TABLE public.subcategoria (
  id integer NOT NULL DEFAULT nextval('subcategoria_id_seq'::regclass),
  id_categoria integer NOT NULL,
  descripcion character varying NOT NULL,
  CONSTRAINT subcategoria_pkey PRIMARY KEY (id),
  CONSTRAINT subcategoria_id_categoria_fkey FOREIGN KEY (id_categoria) REFERENCES public.categoria(id)
);
CREATE TABLE public.tipo_precio (
  id integer NOT NULL DEFAULT nextval('tipo_precio_id_seq'::regclass),
  descripcion character varying NOT NULL,
  CONSTRAINT tipo_precio_pkey PRIMARY KEY (id)
);
CREATE TABLE public.ubicaciones (
  id integer NOT NULL DEFAULT nextval('ubicaciones_id_seq'::regclass),
  descripcion character varying NOT NULL UNIQUE,
  CONSTRAINT ubicaciones_pkey PRIMARY KEY (id)
);
CREATE TABLE public.usuario (
  id integer NOT NULL DEFAULT nextval('usuario_id_seq'::regclass),
  nombre_usuario character varying NOT NULL,
  CONSTRAINT usuario_pkey PRIMARY KEY (id)
);
CREATE TABLE public.usuario_auth (
  auth_user_id uuid NOT NULL,
  usuario_id integer NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  rol text NOT NULL DEFAULT 'admin'::text,
  activo boolean NOT NULL DEFAULT true,
  CONSTRAINT usuario_auth_pkey PRIMARY KEY (auth_user_id),
  CONSTRAINT usuario_auth_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id)
);

CREATE TABLE public.operacion (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  tipo character varying NOT NULL CHECK (upper(TRIM(BOTH FROM tipo)) = ANY (ARRAY['COMPRA'::text, 'VENTA'::text])),
  entidad_nombre character varying,
  numero_comprobante character varying,
  total numeric DEFAULT 0,
  usuario_id integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  observacion text,
  CONSTRAINT operacion_pkey PRIMARY KEY (id),
  CONSTRAINT operacion_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id)
);

CREATE TABLE public.operacion_detalle (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  id_operacion bigint NOT NULL,
  id_producto integer NOT NULL,
  cantidad integer NOT NULL DEFAULT 1,
  precio_unitario numeric DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT operacion_detalle_pkey PRIMARY KEY (id),
  CONSTRAINT operacion_detalle_id_operacion_fkey FOREIGN KEY (id_operacion) REFERENCES public.operacion(id) ON DELETE CASCADE,
  CONSTRAINT operacion_detalle_id_producto_fkey FOREIGN KEY (id_producto) REFERENCES public.productos(id)
);

ALTER TABLE public.producto_serie_movimiento ADD COLUMN id_operacion bigint;
ALTER TABLE public.producto_serie_movimiento ADD CONSTRAINT producto_serie_movimiento_id_operacion_fkey FOREIGN KEY (id_operacion) REFERENCES public.operacion(id) ON DELETE SET NULL;
