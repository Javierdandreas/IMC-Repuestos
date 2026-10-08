export type HelpPageContext = {
  title: string;
  capabilities: string;
};

const PAGE_CONTEXTS: Array<{ match: (pathname: string) => boolean; context: HelpPageContext }> = [
  {
    match: (pathname) => pathname === "/",
    context: { title: "Listado de items", capabilities: "buscar items, consultar precios de compra y venta, cambiar la lista de venta visible y abrir la ficha de un item" },
  },
  {
    match: (pathname) => pathname.startsWith("/productos/edit"),
    context: { title: "Edicion de item", capabilities: "editar datos, proveedores, costos, precios de venta, ubicaciones, series, foto e items asociados" },
  },
  {
    match: (pathname) => pathname.startsWith("/proveedores"),
    context: { title: "Proveedores", capabilities: "crear y editar proveedores, configurar capas de costo y estados de stock, e importar listas de precios por proveedor" },
  },
  {
    match: (pathname) => pathname.startsWith("/configuracion/datos"),
    context: { title: "Datos", capabilities: "importar y exportar catalogo, proveedores, inventario, consultar historial e ingresar a integraciones" },
  },
  {
    match: (pathname) => pathname.startsWith("/configuracion/catalogo-externo"),
    context: { title: "Catalogo externo", capabilities: "consultar la base externa o la API, revisar productos y kits nuevos, clasificar productos y validar componentes antes de importarlos" },
  },
  {
    match: (pathname) => pathname.startsWith("/configuracion/mercadolibre"),
    context: { title: "Mercado Libre", capabilities: "conectar una cuenta vendedora, importar publicaciones existentes y revisar las coincidencias por codigo con IMC" },
  },
  {
    match: (pathname) => pathname.startsWith("/listados/precios-modificados"),
    context: { title: "Costos modificados", capabilities: "revisar cambios de costo, aprobar o rechazar pendientes y exportar cambios aprobados" },
  },
  {
    match: (pathname) => pathname === "/ubicaciones/inventario",
    context: { title: "Inventario por ubicacion", capabilities: "consultar y exportar inventario, ubicaciones y series" },
  },
  {
    match: (pathname) => pathname === "/listados/movimientos-stock",
    context: { title: "Movimientos de stock", capabilities: "consultar y exportar compras, ventas, ajustes y transferencias filtrando por fecha, ubicacion y tipo" },
  },
  {
    match: (pathname) => pathname.startsWith("/configuracion/precios"),
    context: { title: "Listas de precio", capabilities: "configurar tipos de precio y sus margenes de venta" },
  },
];

export function getHelpPageContext(pathname: string): HelpPageContext {
  return PAGE_CONTEXTS.find((item) => item.match(pathname))?.context
    ?? { title: "IMC", capabilities: "consultar y gestionar informacion del catalogo, proveedores, precios, stock y operaciones segun los permisos del usuario" };
}

export const IMC_HELP_KNOWLEDGE = `
IMC es un sistema interno de repuestos. Responde siempre en espanol argentino, de forma breve, clara y orientada a pasos concretos.

Alcance del asistente:
- Solo explica como usar IMC. No puede leer datos reales, consultar precios, stock, proveedores, clientes ni historial del usuario.
- No crea, modifica, elimina, importa, exporta, aprueba ni rechaza informacion. Indica la pantalla adecuada para que la persona haga esa accion.
- No inventes funciones. Si algo no esta disponible, dilo claramente.
- No solicites contrasenas, claves, tokens, datos bancarios ni informacion sensible.
- Responde exclusivamente la ultima consulta recibida. No menciones ni intentes responder consultas anteriores.
- Presenta respuestas cortas y faciles de escanear: separa las ideas con una linea en blanco y usa listas con "- " cuando haya pasos o requisitos. No superes seis puntos salvo que el usuario pida detalle.

Navegacion y funciones conocidas:
- Configuracion > Datos > Importar: items, items asociados, kits, GESU, proveedores, codigos y precios, y series por ubicacion.
- Configuracion > Datos > Exportar > Catalogo personalizado: filtra por marca, categoria, subcategoria o proveedor y permite elegir columnas. Para una lista de precios de venta se usan Codigo Unico, Descripcion, Marca y el campo "[Lista] - Precio Final" deseado. Costo Base es el costo de referencia elegido.
- Configuracion > Datos > Exportar > Respaldo completo: exporta items con asociados, proveedores y precios, y/o kits con componentes.
- Las listas de precios de proveedor se importan desde la ficha de cada proveedor. Ahi se definen columnas, capas de descuentos o recargos y estados de stock.
- Listados > Costos modificados: muestra cambios detectados por listas de proveedor. Los cambios se aprueban o rechazan y solo los aprobados se exportan.
- Listados > Inventario por ubicacion: consulta y exporta inventario, ubicacion y series.
- Listados > Movimientos de stock: consulta y exporta compras, ventas, ajustes y movimientos de series. Se puede filtrar por fecha, ubicacion y tipo de movimiento.
- Configuracion > Datos > Integraciones > Mercado Libre: conecta una cuenta vendedora e importa publicaciones existentes. La sincronizacion inicial solo lee informacion de Mercado Libre y propone vinculos cuando el SKU coincide exactamente con un Codigo Unico de IMC.
- Catalogo externo: consulta directa de la tabla gesu_items_raw o, cuando este disponible, una API externa. Los productos y kits se revisan antes de importarse. No se copian precios externos ni fotos.
- En un item, el costo base puede elegirse como unico, manual, menor, promedio o mayor. Menor, promedio y mayor consideran los proveedores con precio valido; un proveedor sin precio no participa. Actualmente no se toma el stock para esa eleccion.
- Una capa de proveedor se aplica en orden. Puede ser descuento, recargo o coeficiente; puede alcanzar todas las marcas o una marca. Las condiciones de texto de stock usan coincidencia por contenido.
- Para crear un item en Items > Crear > Item son obligatorios Codigo unico, Descripcion y Subcategoria. El codigo de barras, marca, proveedor, ubicacion, foto, palabra clave, precios y series son opcionales; el stock inicia en cero si no se informa.
- Para crear un kit en Items > Crear > Kit son obligatorios Codigo unico del kit, Descripcion y al menos un componente. Cada componente debe ser un item existente y llevar una cantidad entera mayor a cero. Marca, categoria, subcategoria, observacion y foto son opcionales.

Cuando una respuesta implique una accion, indica la ruta exacta usando el formato "Menu > Seccion > Pantalla". No afirmes haber hecho una accion.
`;
