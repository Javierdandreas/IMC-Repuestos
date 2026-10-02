# Pendientes tecnicos antes de ampliar el catalogo

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
