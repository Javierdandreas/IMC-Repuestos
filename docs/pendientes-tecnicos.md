# Prioridades acordadas el 2026-10-05

Analisis inicial seguido de cambios locales en busqueda e importacion. No se aplicaron borrados ni cambios de datos en produccion.
Esta seccion reemplaza las prioridades y decisiones antiguas conservadas debajo.

## 1. Importaciones y conversion de items a kits

- Implementado localmente: GESU prepara lotes temporales y solo aplica items, kits y conversiones dentro de una transaccion. Una sesion incompleta o un error revierte todo. La pagina conserva el identificador de sesion para consultar/reintentar si se corta la conexion durante la aplicacion.
- Implementado localmente: el item convertido se borra fisicamente despues de validar el kit, no se oculta. Antes del borrado se bloquean stock propio, stock por ubicacion, series, operaciones, uso en otros kits e integraciones o relaciones no reconocidas. Se conserva una actividad con una copia de producto, precios y proveedores.
- Implementado localmente: pantalla para revisar los items ya ocultos por conversiones anteriores, mostrando los bloqueos y permitiendo eliminar explicitamente solo los elegibles.
- Implementado localmente: todas las entradas de kits, incluidas las manuales, exigen cantidades enteras positivas y seguras. Una celda vacia ya no se transforma silenciosamente en 1 cuando la columna esta mapeada.
- Requiere aplicar `database/42-importacion-gesu-atomica.sql` antes de desplegar. La migracion y los flujos se validaron en PostgreSQL aislado; no se ejecuto en Supabase productivo.
- Unificar orden de items y kits por fecha de creacion y desempate estable. Hoy se combinan posiciones calculadas por separado.

## 2. Completar Datos y Listados

- Ya implementado: Configuracion > Datos con Importar, Exportar, Historial e Integraciones.
- Mantener listas de precios dentro del proveedor.
- Completar exportacion con modos personalizada y respaldo completo, criterios y columnas consistentes.
- Costos modificados e inventario ya disponibles. Pendiente movimientos de stock y revision de filtros, exportaciones e historial.

## 3. Nuevos puntos

- Solaut: descargar productos relacionados y ejecutar el scraper para preparar/importar su lista. No se encontro el scraper en src, scripts y docs revisados. Al retomarlo, identificar sitio, acceso, ubicacion del scraper y formato. Conservar codigos como texto y usar vista previa antes de aplicar.
- Stock por texto (mas adelante): permitir asociar texto recibido con estado y texto visible por proveedor. Hoy se personalizan colores; el reconocimiento textual es fijo. Las capas de costo YA admiten condiciones por texto, que son una funcion distinta. Conservar texto original y definir prioridad de coincidencias y alcance por marca/todas.
- Busqueda ampliada implementada localmente: listado unificado, API de productos, consulta de exportacion y buscador de componentes comparten condiciones. Incluye codigos internos, barras, proveedor, pieza, OEM/originales, equivalentes, sustitutos y series; ademas descripcion, palabras clave, medida, observaciones de referencias, marca, proveedor, clasificacion y ubicaciones. Kits buscan tambien nombre, descripcion, clasificacion y datos de componentes. Busqueda especifica sigue siendo por codigo exacto, sin distinguir mayusculas y conservando ceros y diferencia O/0. Pruebas PostgreSQL aisladas cubren 39 casos; no desplegado. La pantalla de exportacion personalizada mantiene sus filtros propios, no hereda automaticamente el texto del listado.
- Implementado localmente: `Configuracion > Datos > Mantenimiento > Criterios y precios` filtra por marca, categoria, subcategoria y proveedor. Permite asignar un criterio de costo al conjunto filtrado y muestra el alcance antes de aplicar.
- Implementado localmente: la correccion masiva calcula primero el costo neto de cada proveedor, aplica el criterio vigente y crea la fila `PRECIO COSTO` y las listas activas faltantes. Las listas ya existentes conservan su margen; las nuevas usan el margen por defecto configurado. Los items sin costo valido quedan sin modificar y se informan en el resultado.
- Implementado localmente: `aplicarPreciosDesdeCostosReferencia` completa filas faltantes tambien cuando se importa una lista de proveedor, de modo que no hace falta abrir y guardar cada ficha individual para que aparezcan sus precios.
- Implementado localmente: despues de un proceso masivo, los items sin costo asignable se muestran por codigo con criterio, proveedores validos y motivo; se pueden paginar y exportar a Excel. Es un resultado inmediato segun los filtros actuales, no un historial guardado de ejecuciones.
- Mantener calculos sin stock y excluir proveedores sin precio valido. Usar costo neto con capas y no aprobar cambios pendientes implicitamente durante el recalculo masivo.

## Fuera del foco actual

Migracion de Supabase (60 archivos de Storage y configuracion restante), bot, API externa con 401, cron cada 15 minutos y agente general de descarga quedan postergados.
Las decisiones iniciales de docs/pendientes-costos-proveedores.md sobre seleccionar costos segun disponibilidad tambien quedaron reemplazadas: el stock no interviene en menor/promedio/mayor.

# Registro anterior (consultar prioridades actualizadas arriba)

Estos puntos fueron detectados en la revision previa al despliegue del catalogo. No se aplican cambios sin revisarlos primero.

1. Validar que la cantidad importada de un componente de kit sea mayor a cero. Hoy el valor cero pasa a uno y un negativo puede aceptarse.
2. Hacer atomica la importacion desde GESU: items, kits y ocultamiento de originales deben completarse juntos o no aplicar ninguno.
3. Definir si los productos convertidos en kit deben eliminarse fisicamente o mantenerse ocultos para conservar historial.
4. Ordenar items y kits juntos por una misma fecha de creacion, no por dos listados separados.
5. Confirmar que Vercel use la misma base de datos donde se aplicaron las migraciones 24 a 32.

## Catalogo externo por API (pausado)

1. IMC ya puede consumir la API mediante `EXTERNAL_CATALOG_API_URL` y `EXTERNAL_CATALOG_API_TOKEN`.
2. Las rutas de `imc-cerebro` estan publicadas, pero la llamada autenticada sigue devolviendo 401. Igualar el token de IMC con la variable exacta que valida la API externa y redeployar ambos proyectos.
3. Al retomarlo, validar resumen, paginacion completa, productos, kits y componentes con una sincronizacion real.
4. Solo despues de esa validacion, eliminar `EXTERNAL_SUPABASE_URL` y `EXTERNAL_SUPABASE_KEY` de IMC.

## Organizacion de datos y listados (pendiente acordado)

1. Centralizar las cargas y descargas en `Configuracion > Datos`, con pestañas `Importar`, `Exportar`, `Historial` e `Integraciones`.
2. Mantener las listas de precio dentro de cada proveedor, porque sus columnas, capas y estados de stock dependen de ese proveedor.
3. Reservar `Listados` para control operativo: costos modificados, inventario por ubicacion, movimientos de stock y futuros controles de faltantes.
4. Unificar la exportacion de catalogo en una sola pantalla con dos modos: personalizada y respaldo completo.
