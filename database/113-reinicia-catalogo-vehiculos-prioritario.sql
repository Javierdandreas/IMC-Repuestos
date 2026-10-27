BEGIN;

CREATE TABLE IF NOT EXISTS public.mercadolibre_catalogo_vehiculo_marca_objetivo (
  dominio_id text NOT NULL DEFAULT 'MLA-CARS_AND_VANS',
  marca_nombre text NOT NULL,
  marca_id text,
  activa boolean NOT NULL DEFAULT TRUE,
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (dominio_id, marca_nombre)
);

-- Se conservan las compatibilidades asignadas a piezas. Al borrar los
-- vehiculos canonicos, sus referencias id_vehiculo quedan en NULL por FK.
DELETE FROM public.mercadolibre_catalogo_vehiculo_cola
WHERE dominio_id = 'MLA-CARS_AND_VANS';

DELETE FROM public.mercadolibre_catalogo_vehiculo_valor
WHERE dominio_id = 'MLA-CARS_AND_VANS';

DELETE FROM public.mercadolibre_catalogo_vehiculo_atributo
WHERE dominio_id = 'MLA-CARS_AND_VANS';

DELETE FROM public.mercadolibre_catalogo_vehiculo
WHERE dominio_id = 'MLA-CARS_AND_VANS';

DELETE FROM public.mercadolibre_catalogo_vehiculo_marca_objetivo
WHERE dominio_id = 'MLA-CARS_AND_VANS';

INSERT INTO public.mercadolibre_catalogo_vehiculo_marca_objetivo (dominio_id, marca_nombre)
VALUES
  ('MLA-CARS_AND_VANS', 'Alfa Romeo'),
  ('MLA-CARS_AND_VANS', 'Aston Martin'),
  ('MLA-CARS_AND_VANS', 'Audi'),
  ('MLA-CARS_AND_VANS', 'BAIC'),
  ('MLA-CARS_AND_VANS', 'BMW'),
  ('MLA-CARS_AND_VANS', 'BYD'),
  ('MLA-CARS_AND_VANS', 'Chery'),
  ('MLA-CARS_AND_VANS', 'Chevrolet'),
  ('MLA-CARS_AND_VANS', 'Chrysler'),
  ('MLA-CARS_AND_VANS', U&'Citro\00EBn'),
  ('MLA-CARS_AND_VANS', 'D.S.'),
  ('MLA-CARS_AND_VANS', U&'D\00B7S'),
  ('MLA-CARS_AND_VANS', 'Dacia'),
  ('MLA-CARS_AND_VANS', 'Daewoo'),
  ('MLA-CARS_AND_VANS', 'Daihatsu'),
  ('MLA-CARS_AND_VANS', 'Dodge'),
  ('MLA-CARS_AND_VANS', 'Fiat'),
  ('MLA-CARS_AND_VANS', 'Ford'),
  ('MLA-CARS_AND_VANS', 'Foton'),
  ('MLA-CARS_AND_VANS', 'GWM'),
  ('MLA-CARS_AND_VANS', 'Honda'),
  ('MLA-CARS_AND_VANS', 'Hyundai'),
  ('MLA-CARS_AND_VANS', 'Isuzu'),
  ('MLA-CARS_AND_VANS', 'Iveco'),
  ('MLA-CARS_AND_VANS', 'Jaguar'),
  ('MLA-CARS_AND_VANS', 'Jeep'),
  ('MLA-CARS_AND_VANS', 'Kia'),
  ('MLA-CARS_AND_VANS', 'Lancia'),
  ('MLA-CARS_AND_VANS', 'Land'),
  ('MLA-CARS_AND_VANS', 'Land Rover'),
  ('MLA-CARS_AND_VANS', 'Mercedes-Benz'),
  ('MLA-CARS_AND_VANS', 'MINI'),
  ('MLA-CARS_AND_VANS', 'Mitsubishi'),
  ('MLA-CARS_AND_VANS', 'Nissan'),
  ('MLA-CARS_AND_VANS', 'Opel'),
  ('MLA-CARS_AND_VANS', 'Peugeot'),
  ('MLA-CARS_AND_VANS', 'Porsche'),
  ('MLA-CARS_AND_VANS', 'Proton'),
  ('MLA-CARS_AND_VANS', 'RAM'),
  ('MLA-CARS_AND_VANS', 'Renault'),
  ('MLA-CARS_AND_VANS', 'Rolls-Royce'),
  ('MLA-CARS_AND_VANS', 'Rover'),
  ('MLA-CARS_AND_VANS', 'Santana'),
  ('MLA-CARS_AND_VANS', 'Seat'),
  ('MLA-CARS_AND_VANS', 'Skoda'),
  ('MLA-CARS_AND_VANS', 'Smart'),
  ('MLA-CARS_AND_VANS', 'Subaru'),
  ('MLA-CARS_AND_VANS', 'Suzuki'),
  ('MLA-CARS_AND_VANS', 'Toyota'),
  ('MLA-CARS_AND_VANS', 'Volkswagen'),
  ('MLA-CARS_AND_VANS', 'Volvo');

INSERT INTO public.mercadolibre_catalogo_vehiculo_sincronizacion
  (dominio_id, estado, siguiente_marca, total_marcas, ultimo_error, iniciada_at, finalizada_at, updated_at)
VALUES ('MLA-CARS_AND_VANS', 'PENDIENTE', 0, 51, NULL, NULL, NULL, NOW())
ON CONFLICT (dominio_id) DO UPDATE
SET estado = 'PENDIENTE',
    siguiente_marca = 0,
    total_marcas = 51,
    ultimo_error = NULL,
    iniciada_at = NULL,
    finalizada_at = NULL,
    updated_at = NOW();

COMMIT;
