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
