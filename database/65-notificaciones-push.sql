BEGIN;

CREATE TABLE IF NOT EXISTS public.notificacion_push_suscripcion (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id integer NOT NULL REFERENCES public.usuario(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notificacion_push_suscripcion_usuario
  ON public.notificacion_push_suscripcion (usuario_id, updated_at DESC);

COMMIT;
