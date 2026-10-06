export function parametroBusquedaItems(value: string, exact = false) {
  const text = value.trim();
  return exact ? text : `%${text.replace(/[\\%_]/g, "\\$&")}%`;
}

// EXISTS matches related data without filtering the rows used to build aggregates.
export function condicionBusquedaProducto(
  parameter: number,
  exact = false,
  alias: "p" | "componente" = "p"
) {
  const match = (column: string) => exact
    ? `UPPER(${column}::text) = UPPER($${parameter}::text)`
    : `${column}::text ILIKE $${parameter}`;

  const conditions = [
    match(`${alias}.cod_unico`),
    match(`${alias}.cod_barra`),
    `EXISTS (
      SELECT 1 FROM public.pieza buscar_pieza
      WHERE buscar_pieza.id = ${alias}.id_pieza
        AND (${[
          match("buscar_pieza.codigo_pieza"),
          ...(!exact ? [match("buscar_pieza.descripcion"), match("buscar_pieza.medida")] : []),
        ].join(" OR ")})
    )`,
    `EXISTS (
      SELECT 1 FROM public.producto_proveedor buscar_pp
      LEFT JOIN public.proveedores buscar_proveedor ON buscar_proveedor.id = buscar_pp.id_proveedor
      WHERE buscar_pp.id_producto = ${alias}.id
        AND (${match("buscar_pp.codigo_proveedor")}${!exact ? ` OR ${match("buscar_proveedor.descripcion")}` : ""})
    )`,
    `EXISTS (
      SELECT 1 FROM public.pieza_codigo_referencia buscar_pcr
      JOIN public.codigo_referencia buscar_referencia ON buscar_referencia.id = buscar_pcr.id_codigo_referencia
      WHERE buscar_pcr.id_pieza = ${alias}.id_pieza
        AND (${match("buscar_referencia.codigo")}${!exact ? ` OR ${match("buscar_pcr.observacion")}` : ""})
    )`,
    `EXISTS (
      SELECT 1 FROM public.producto_serie buscar_serie
      WHERE buscar_serie.id_producto = ${alias}.id AND ${match("buscar_serie.numero_serie")}
    )`,
  ];

  if (!exact) {
    conditions.push(
      match(`${alias}.descripcion`),
      match(`${alias}.palabra_clave`),
      `EXISTS (
        SELECT 1 FROM public.marcas buscar_marca
        WHERE buscar_marca.id = ${alias}.id_marca AND ${match("buscar_marca.descripcion")}
      )`,
      `EXISTS (
        SELECT 1 FROM public.subcategoria buscar_subcategoria
        LEFT JOIN public.categoria buscar_categoria ON buscar_categoria.id = buscar_subcategoria.id_categoria
        WHERE buscar_subcategoria.id = ${alias}.id_subcategoria
          AND (${match("buscar_subcategoria.descripcion")} OR ${match("buscar_categoria.descripcion")})
      )`,
      `EXISTS (
        SELECT 1 FROM public.ubicaciones buscar_ubicacion
        WHERE buscar_ubicacion.id = ${alias}.id_ubicacion AND ${match("buscar_ubicacion.descripcion")}
      )`,
      `EXISTS (
        SELECT 1 FROM public.producto_stock_ubicacion buscar_stock
        JOIN public.ubicaciones buscar_ubicacion ON buscar_ubicacion.id = buscar_stock.id_ubicacion
        WHERE buscar_stock.id_producto = ${alias}.id AND buscar_stock.cantidad > 0
          AND ${match("buscar_ubicacion.descripcion")}
      )`,
      `EXISTS (
        SELECT 1 FROM public.producto_serie buscar_serie
        JOIN public.ubicaciones buscar_ubicacion ON buscar_ubicacion.id = buscar_serie.id_ubicacion
        WHERE buscar_serie.id_producto = ${alias}.id AND ${match("buscar_ubicacion.descripcion")}
      )`
    );
  }

  return `(${conditions.join("\n OR ")})`;
}

export function condicionBusquedaKit(parameter: number, exact = false) {
  const match = (column: string) => exact
    ? `UPPER(${column}::text) = UPPER($${parameter}::text)`
    : `${column}::text ILIKE $${parameter}`;
  const conditions = [match("k.codigo_kit")];

  if (!exact) {
    conditions.push(
      match("k.nombre"),
      match("k.descripcion"),
      `EXISTS (
        SELECT 1 FROM public.subcategoria buscar_subcategoria
        WHERE buscar_subcategoria.id = k.id_subcategoria AND ${match("buscar_subcategoria.descripcion")}
      )`,
      `EXISTS (
        SELECT 1 FROM public.categoria buscar_categoria
        WHERE (buscar_categoria.id = k.id_categoria OR buscar_categoria.id IN (
          SELECT id_categoria FROM public.subcategoria WHERE id = k.id_subcategoria
        )) AND ${match("buscar_categoria.descripcion")}
      )`
    );
  }

  conditions.push(`EXISTS (
    SELECT 1 FROM public.kit_detalle buscar_detalle
    JOIN public.productos componente ON componente.id = buscar_detalle.id_producto
    WHERE buscar_detalle.id_kit = k.id
      AND COALESCE(componente.oculto_por_kit, FALSE) = FALSE
      AND ${condicionBusquedaProducto(parameter, exact, "componente")}
  )`);

  return `(${conditions.join("\n OR ")})`;
}
