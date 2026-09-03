WITH proveedor_prueba AS (
  INSERT INTO public.proveedores (
    descripcion,
    documento,
    condicion_iva,
    comprobante_default
  )
  SELECT
    'PROVEEDOR PRUEBA LISTAS',
    '30711222331',
    'RESPONSABLE_INSCRIPTO',
    'FACTURA_A'
  
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.proveedores
    WHERE descripcion = 'PROVEEDOR PRUEBA LISTAS'
  )
  RETURNING id
),
proveedor_update AS (
  UPDATE public.proveedores
  SET
    documento = '30711222331',
    condicion_iva = 'RESPONSABLE_INSCRIPTO',
    comprobante_default = 'FACTURA_A'
  WHERE descripcion = 'PROVEEDOR PRUEBA LISTAS'
  RETURNING id
),
proveedor AS (
  SELECT id FROM proveedor_prueba
  UNION ALL
  SELECT id FROM proveedor_update
  UNION ALL
  SELECT id FROM public.proveedores WHERE descripcion = 'PROVEEDOR PRUEBA LISTAS'
  LIMIT 1
),
base AS (
  SELECT
    (SELECT id FROM proveedor) AS id_proveedor,
    (SELECT id FROM public.subcategoria ORDER BY id LIMIT 1) AS id_subcategoria,
    (SELECT id FROM public.marcas ORDER BY id LIMIT 1) AS id_marca,
    COALESCE(
      (SELECT id FROM public.ubicaciones WHERE descripcion = 'SIN UBICACION' LIMIT 1),
      (SELECT id FROM public.ubicaciones ORDER BY id LIMIT 1)
    ) AS id_ubicacion
),
items(cod_unico, descripcion, cod_barra, stock, codigo_proveedor, precio_lista_actual) AS (
  VALUES
    ('PRVTEST-001', 'ITEM PRUEBA IMPORTACION PROVEEDOR 1', '7790000001011', 0, 'LST-1001', 1000.00),
    ('PRVTEST-002', 'ITEM PRUEBA IMPORTACION PROVEEDOR 2', '7790000001028', 0, 'LST-1002', 2500.00),
    ('PRVTEST-003', 'ITEM PRUEBA IMPORTACION PROVEEDOR 3', '7790000001035', 0, 'LST-1003', 500.00)
),
productos_upsert AS (
  INSERT INTO public.productos (
    cod_unico,
    descripcion,
    cod_barra,
    stock,
    id_subcategoria,
    id_marca,
    id_ubicacion,
    usa_numero_serie
  )
  SELECT
    i.cod_unico,
    i.descripcion,
    i.cod_barra,
    i.stock,
    b.id_subcategoria,
    b.id_marca,
    b.id_ubicacion,
    false
  FROM items i
  CROSS JOIN base b
  ON CONFLICT (cod_unico) DO UPDATE
  SET
    descripcion = EXCLUDED.descripcion,
    cod_barra = EXCLUDED.cod_barra,
    id_subcategoria = EXCLUDED.id_subcategoria,
    id_marca = EXCLUDED.id_marca,
    id_ubicacion = EXCLUDED.id_ubicacion,
    usa_numero_serie = false
  RETURNING id, cod_unico
)
INSERT INTO public.producto_proveedor (
  id_producto,
  id_proveedor,
  codigo_proveedor,
  precio_lista_actual,
  fecha_ultima_actualizacion
)
SELECT
  p.id,
  b.id_proveedor,
  i.codigo_proveedor,
  i.precio_lista_actual,
  NOW()
FROM productos_upsert p
JOIN items i ON i.cod_unico = p.cod_unico
CROSS JOIN base b
ON CONFLICT (id_producto, id_proveedor) DO UPDATE
SET
  codigo_proveedor = EXCLUDED.codigo_proveedor,
  precio_lista_actual = EXCLUDED.precio_lista_actual,
  fecha_ultima_actualizacion = NOW();
