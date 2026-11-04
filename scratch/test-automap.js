const normalizeHeader = (value) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const SYSTEM_FIELDS = [
  { id: 'cod_unico', label: 'Código interno', description: 'Identificador único del item', group: 'Datos principales', required: true, aliases: ['codigo', 'codigo unico', 'codigo único', 'codigo interno', 'cod unico', 'cod_unico', 'sku', 'item', 'codigo producto', 'id producto'] },
  { id: 'titulo', label: 'Descripción', description: 'Nombre o título del item', group: 'Datos principales', aliases: ['titulo', 'descripcion', 'descripción', 'nombre', 'producto', 'articulo', 'artículo', 'detalle'] },
  { id: 'cod_barra', label: 'Código de barras', description: 'EAN, barcode o código escaneable', group: 'Datos principales', aliases: ['codigo barra', 'codigo de barras', 'cod barra', 'cod_barra', 'barcode', 'ean', 'gtin'] },
  { id: 'stock', label: 'Stock actual', description: 'Cantidad disponible', group: 'Datos principales', aliases: ['stock', 'cantidad', 'existencia', 'existencias', 'disponible', 'inventario', 'qty'] },
  { id: 'marca', label: 'Marca', description: 'Marca o fabricante', group: 'Clasificación', aliases: ['marca', 'brand', 'fabricante'] },
  { id: 'subcategoria', label: 'Subcategoría', description: 'Rubro/subrubro que existe en el sistema', group: 'Clasificación', aliases: ['subcategoria', 'subcategoría', 'sub categoria', 'sub categoría', 'subrubro', 'rubro', 'familia'] },
  { id: 'ubicacion', label: 'Ubicación', description: 'Ubicación interna inicial', group: 'Clasificación', aliases: ['ubicacion', 'ubicación', 'location', 'deposito', 'depósito', 'almacen', 'almacén', 'pasillo', 'estante', 'rack'] },
  { id: 'codigo_pieza', label: 'Código de item asociado', description: 'Número del item asociado o referencia', group: 'Item asociado y proveedor', aliases: ['codigo pieza', 'codigo de pieza', 'cod pieza', 'nro pieza', 'nro item asociado', 'numero pieza', 'número pieza', 'parte', 'part number', 'numero parte', 'número parte', 'codigo item asociado', 'item asociado'] },
  { id: 'palabra_clave', label: 'Palabras clave', description: 'Texto auxiliar de búsqueda', group: 'Item asociado y proveedor', aliases: ['palabra clave', 'palabras clave', 'keywords', 'keyword', 'clave', 'etiquetas', 'tags'] },
  { id: 'proveedor', label: 'Proveedor', description: 'Proveedor asociado al item', group: 'Item asociado y proveedor', aliases: ['proveedor', 'supplier', 'vendor'] },
  { id: 'codigo_proveedor', label: 'Código proveedor', description: 'Código del item en el proveedor', group: 'Item asociado y proveedor', aliases: ['codigo proveedor', 'codigo en proveedor', 'cod proveedor', 'sku proveedor', 'item proveedor', 'referencia proveedor', 'codigo lista'] },
  { id: 'precio_lista_proveedor', label: 'Precio lista proveedor', description: 'Precio informado por el proveedor', group: 'Item asociado y proveedor', aliases: ['precio lista proveedor', 'precio proveedor', 'lista proveedor', 'precio lista', 'costo proveedor', 'precio de proveedor'] },
  { id: 'costo_base', label: 'Costo base', description: 'Costo directo del item; establece criterio Manual', group: 'Precios y margenes', aliases: ['costo base', 'precio costo', 'costo', 'cost', 'costo directo'] },
  { id: 'moneda_costo_base', label: 'Moneda del costo', description: 'Moneda indicada para el costo base de cada fila', group: 'Precios y margenes', aliases: ['moneda', 'moneda costo', 'moneda del costo', 'divisa', 'currency', 'currencia', 'moneda base', 'moneda origen', 'tipo moneda'] },
];

const tiposPrecio = [
  { id: 2, descripcion: 'MOSTRADOR' },
  { id: 3, descripcion: 'MECANICO' },
  { id: 4, descripcion: 'MERCADO LIBRE' },
  { id: 5, descripcion: 'OFERTA' },
  { id: 7, descripcion: 'CUENTA CORRIENTE' },
];

const marginFields = tiposPrecio.map((tipo) => {
  const descripcion = normalizeHeader(tipo.descripcion);
  const compactDescripcion = descripcion.replace(/\s+/g, "");
  return {
    id: `margen_tipo_precio_${tipo.id}`,
    label: `Margen ${tipo.descripcion} (%)`,
    aliases: [
      `${descripcion} porcentaje`,
      `${descripcion} margen`,
      `margen ${descripcion}`,
      `${compactDescripcion} porcentaje`,
      `${compactDescripcion} margen`,
      `margen ${compactDescripcion}`,
      compactDescripcion,
      descripcion,
    ],
  };
});

const importFields = [...SYSTEM_FIELDS, ...marginFields];

const scoreHeaderForField = (header, field) => {
  const normalizedHeader = normalizeHeader(header);
  let score = 0;

  if (
    (field.id === 'proveedor' || field.id === 'codigo_proveedor') &&
    normalizedHeader.includes('precio') &&
    normalizedHeader.includes('lista')
  ) {
    return 0;
  }

  if (field.id === 'costo_base' && normalizedHeader.includes('moneda')) {
    return 0;
  }

  if (
    field.id === 'precio_lista_proveedor' &&
    (normalizedHeader === 'costo' || normalizedHeader === 'costo base' || normalizedHeader === 'precio costo')
  ) {
    return 0;
  }

  field.aliases.forEach(alias => {
    const normalizedAlias = normalizeHeader(alias);
    if (normalizedHeader === normalizedAlias) score = Math.max(score, 100);
    else if (normalizedHeader.includes(normalizedAlias)) score = Math.max(score, 82);
    else if (normalizedAlias.includes(normalizedHeader) && normalizedHeader.length >= 4) score = Math.max(score, 70);
  });

  return score;
};

const headers = [
  'Código',
  'COSTO BASE',
  'MONEDA',
  'MARGEN MOSTRADOR',
  'MARGEN CUENTA CORRIENTE',
  'MARGEN OFERTA',
  'MARGEN MECANICO',
  'MARGEN MERCADOLIBRE'
];

const usedHeaders = new Set();
importFields.forEach(field => {
  const candidates = headers
    .filter(header => !usedHeaders.has(header))
    .map(header => ({ header, score: scoreHeaderForField(header, field) }))
    .filter(c => c.score >= 70)
    .sort((a,b) => b.score - a.score);
  const match = candidates[0];
  if (match) {
    usedHeaders.add(match.header);
    console.log(`Field ${field.id} (${field.label}) -> ${match.header} (score: ${match.score})`);
  }
});
