-- Reserva permisos por usuario. No modifica los roles ni concede acceso por si sola.
CREATE TABLE IF NOT EXISTS public.usuario_permiso (
  usuario_id integer NOT NULL REFERENCES public.usuario(id) ON DELETE CASCADE,
  apartado text NOT NULL,
  accion text NOT NULL CHECK (accion IN ('leer', 'escribir', 'eliminar', 'exportar', 'masivo')),
  creado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, apartado, accion)
);

ALTER TABLE public.usuario_permiso ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.usuario_permiso FROM PUBLIC, anon, authenticated;
