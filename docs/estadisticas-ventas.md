# Estadisticas de ventas por canal

Ubicacion: Operaciones > Mercado Libre > Estadisticas. Selector con Comparar canales,
Mercado Libre y Mostrador. Periodos: hoy, 7, 30, 90 y 365 dias. Ambos canales usan
las mismas fechas y zona America/Argentina/Buenos_Aires. Se consulta hasta la hora
actual y el periodo previo termina a la misma hora, para comparar igual duracion.

## Origen y criterios

- Mercado Libre usa la base local de ventas sincronizadas: ventas pagadas, importes
  brutos, cancelaciones y devoluciones por separado. Visitas se consultan a ML.
- Mostrador consulta en vivo IMC Control de Presupuestos mediante su API. Incluye
  lineas confirmadas/enviadas a deposito y confirmaciones historicas. No acredita
  facturacion ni cobro. El filtro de deposito permite elegir separados, pendientes
  o no encontrados, o excluir estos ultimos.
- Comparar canales muestra cada origen por separado. No suma ambos como un total
  facturado, ni presume una deduplicacion entre fuentes sin una referencia comun.
- Los totales del mostrador provienen de los KPI de toda la consulta. La paginacion
  del ranking y del detalle nunca reduce esos totales a la pagina visible.
- Las consultas se renuevan cada minuto mientras esta vista esta abierta. La clave
  externa solo viaja entre servidores. Un error remoto se informa; no se reemplaza
  silenciosamente con ventas en cero.

## Configuracion

Variables exclusivamente de servidor:

```text
MOSTRADOR_ESTADISTICAS_URL=https://imc-cerebro.vercel.app
MOSTRADOR_ESTADISTICAS_API_KEY=<clave entregada por IMC Control de Presupuestos>
```

La clave no debe llevar prefijo NEXT_PUBLIC ni aparecer en repositorios, URLs,
capturas, logs o respuestas al navegador. El proxy requiere la misma sesion y permiso
ml_integracion de la seccion existente de estadisticas.

Rutas internas autenticadas:

- `/api/integraciones/mercadolibre/estadisticas?idCuenta=...&dias=...&hasta=<ISO>`
- `/api/integraciones/mercadolibre/estadisticas/mostrador?dias=...&hasta=<ISO>`
- Agregar `vista=ventas` para detalle del mostrador, y `cursor` para la pagina siguiente.
- Filtros de mostrador: `q`, `estadoDeposito`, `incluirNoEncontrados`, `pagina` del ranking.

## Correcciones

El ranking de productos ML compartia un array de cuatro parametros con otras consultas
pero no referenciaba $2. PostgreSQL no podia determinar su tipo. Ahora usa parametros
propios consecutivos, verificados con consultas reales de PostgreSQL.

Clientes GESU estaba detenido en pagina 7: la API devolvia HTTP 200 con un objeto
`error` indicando "Parametro pag con valor invalido", en lugar de header/data.
Ahora se distingue ese caso y se recupera el cursor a pagina 1 para la siguiente
ejecucion. No se realiza una segunda llamada en la misma ejecucion y no se confunde
un limite de consultas con una pagina fuera de rango. Las condiciones comerciales
locales del cliente conservan el comportamiento existente de carga inicial.
