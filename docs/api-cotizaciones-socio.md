# Cotizacion por cliente para socios

## Acceso

`POST /api/partner/cotizar`, en el dominio de Nexo, con `Content-Type: application/json`
y `X-API-Key` (la misma `PARTNER_CATALOG_API_KEY` del catalogo/clientes).
Llamar desde el servidor del integrador; nunca colocar la clave en el navegador.

```json
{
  "tipoDocumento": "CUIT",
  "numeroDocumento": "30711111119",
  "items": [
    { "codigo": "CODIGO_INTERNO_ITEM", "tipo": "ITEM", "cantidad": 2 },
    { "codigo": "CODIGO_INTERNO_KIT", "tipo": "KIT", "cantidad": 1 }
  ]
}
```

Hasta 100 lineas, cantidades enteras entre 1 y 10000. Documento de 6 a 11 digitos,
con puntos, espacios o guiones opcionales. Los codigos se comparan sin distinguir
mayusculas, pero deben ser los **codigos internos exactos** de Nexo. A diferencia
de `/api/partner/catalogo`, este endpoint no busca por OEM, proveedor, equivalente
ni componentes. `tipo` puede omitirse si el codigo identifica un unico articulo.
Si existe como item y kit, indicar el tipo. Agrupar cantidades de lineas repetidas.

## Respuesta

Ejemplo con una sola linea:

```json
{
  "cotizacionId": "b896a372-c66d-4794-8e81-c50167c75c2f",
  "cotizadoAt": "2026-11-17T18:30:00.000Z",
  "moneda": "ARS",
  "ivaIncluido": true,
  "clienteEncontrado": true,
  "items": [
    {
      "codigo": "CODIGO_INTERNO_ITEM",
      "tipo": "ITEM",
      "cantidad": 2,
      "encontrado": true,
      "descripcion": "Articulo de ejemplo",
      "precioUnitarioFinal": 84500,
      "subtotal": 169000,
      "stockDisponible": 4,
      "stockSuficiente": true,
      "error": null
    }
  ],
  "total": 169000,
  "puedeConfirmar": true,
  "stockReservado": false,
  "requiereConfirmarCambios": false,
  "cambiosPrecio": []
}
```

El precio ya tiene aplicado el descuento del cliente. **No descontar otra vez**:
al enviar ese precio final a GESU, la bonificacion de la linea debe ser 0.
Se calcula en ARS con las listas locales de Nexo y se redondea el unitario a dos
decimales antes de multiplicarlo por la cantidad. `precioUnitarioFinal` incluye IVA,
igual que `precioMostrador`: las listas de venta se consideran precios finales
con IVA incluido. El descuento se aplica sobre ese final. No agregar IVA otra vez.
`ivaIncluido: true` identifica este criterio en la respuesta.

No devuelve lista asignada, precio antes de descuento, porcentajes, costos ni
margenes. Nexo guarda esos datos en una auditoria privada del calculo.

## Condiciones comerciales

Se toma la lista activa del cliente, o MOSTRADOR si no tiene lista asignada.
Una lista asignada invalida, desactivada o de uso interno (PRECIO COSTO o
MERCADO LIBRE) se rechaza con 422; no se reemplaza silenciosamente.
La lista MERCADO LIBRE representa otro calculo y no es una lista para pedidos.

Las reglas se configuran en Contactos > Clientes > Editar > Condiciones comerciales.
Se permiten marca, categoria, subcategoria o combinaciones de esos filtros.
La subcategoria siempre queda ligada a su categoria. Una regla especial reemplaza
la bonificacion general, incluso si su descuento es 0. Una regla mas especifica
prevalece sobre las que contiene. Entre alcances cruzados se usa el mayor
porcentaje. Los porcentajes no se suman ni se aplican sucesivamente.

Los kits por componentes suman los precios de **la lista elegida** de todos sus
componentes multiplicados por sus cantidades. Los kits manuales usan su precio
manual de esa lista. Luego se aplica una unica regla segun marca/categoria del
propio kit. No se descuentan por separado los componentes. Un kit vacio, con un
componente inactivo o sin precio en la lista (salvo kit manual) queda bloqueado.

Las condiciones de clientes importadas de GESU son una carga inicial. El
sincronizador actual conserva las condiciones comerciales locales en siguientes
pasadas. Editarlas en GESU no actualiza automaticamente estas reglas en Nexo.

## Presupuesto y confirmacion

1. Mostrar MOSTRADOR para la busqueda inicial mediante `/api/partner/catalogo`.
2. Al elegir cliente, cotizar el carrito con este endpoint y mostrar los finales.
3. Guardar en el presupuesto `cotizacionId`, fecha, moneda, codigos, cantidades y precios.
4. Antes de confirmar, volver a llamar con el mismo documento y las mismas lineas,
   agregando `cotizacionAnteriorId`.
5. Si `requiereConfirmarCambios` es true, mostrar los nuevos precios para aceptacion
   del usuario. `cambiosPrecio` enumera los codigos cuyo precio cambio. No confirmar
   automaticamente. Tras la aceptacion, guardar la nueva referencia; una nueva
   consulta comparada contra esa referencia verifica que los precios sigan iguales.
6. El sistema externo guarda el precio aceptado en su orden; cambios futuros no lo
   alteran. Los renglones manuales conservan su precio local. La decision de confirmar
   el pedido y el tratamiento de faltantes de stock pertenecen a ese sistema.

La comparacion exige el mismo cliente, codigos, tipos y cantidades. Para un carrito
modificado, generar una cotizacion nueva. No es un endpoint para crear presupuestos,
confirmar ordenes, enviar a GESU ni reservar unidades.

`GET /api/partner/cotizar?id=<cotizacionId>` con la misma clave recupera la respuesta
original guardada. No recalcula ni actualiza el stock de esa respuesta historica.
No usar GET para confirmar disponibilidad actual.

## Stock y errores

`stockDisponible` es el stock local al cotizar (en kits, unidades armables segun
sus componentes). El control del carrito suma consumos de componentes compartidos:
dos kits o un item mas un kit no pueden contar las mismas unidades dos veces.
`stockReservado` siempre es false. Segun el circuito confirmado por IMC y soporte
de GESU, el stock se descuenta al facturar, sin reserva previa en Deposito.
Los indicadores de stock son informativos para el integrador. No hay soporte
de cajas/bultos: Deposito sigue escaneando cada unidad.

Errores HTTP: 400 JSON/parametros/carrito invalido; 401 clave incorrecta; 404 cliente
activo o cotizacion anterior inexistente; 409 documento de cliente duplicado;
422 lista comercial invalida; 503 falta configurar la clave; 500 error interno.

Errores por linea (HTTP 200): `CODIGO_NO_ENCONTRADO`, `CODIGO_AMBIGUO`,
`ARTICULO_INACTIVO`, `KIT_INCOMPLETO`, `SIN_PRECIO`. Devuelven precio y subtotal
null y hacen que `total` sea null y `puedeConfirmar` false. Un precio ausente nunca
se transforma en una venta gratuita. El descuento valido de 100% si puede dar 0.
Si falta stock se conserva el precio pero `stockSuficiente` y `puedeConfirmar`
son false. La consulta no llama a GESU ni consume su cuota de API.

### Codigos manuales o inexistentes

Un codigo inexistente devuelve HTTP 200 y solo ese renglon se marca:

```json
{
  "codigo": "REPUESTO-MANUAL",
  "tipo": null,
  "cantidad": 1,
  "encontrado": false,
  "descripcion": null,
  "precioUnitarioFinal": null,
  "subtotal": null,
  "stockDisponible": 0,
  "stockSuficiente": false,
  "error": "CODIGO_NO_ENCONTRADO"
}
```

Los otros renglones se cotizan normalmente. Cuando `encontrado` es false, mantener
el precio manual del presupuesto: no reemplazarlo con null ni 0. El integrador
calcula su total combinando los finales encontrados con sus precios manuales.
`total: null` y `puedeConfirmar: false` indican que Nexo no puede validar el
carrito entero; no son un error HTTP ni impiden que el sistema externo resuelva
sus lineas manuales. `encontrado` true significa que el codigo existe, no que
sea cotizable: revisar tambien `error` (por ejemplo, `SIN_PRECIO` o `CODIGO_AMBIGUO`).

## Despliegue

Ejecutar primero `database/138-clientes-reglas-cotizaciones.sql`, luego desplegar
el codigo. La migracion es aditiva y copia las reglas por marca existentes.
Mantener el contrato actual de `/api/partner/clientes` y `/api/partner/catalogo`.
Las reservas, empaques y confirmacion de ordenes siguen fuera de este endpoint.
