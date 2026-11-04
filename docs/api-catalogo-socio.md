# API de catalogo para socio

Endpoint de solo lectura para consultar el catalogo enriquecido. No entrega acceso directo a la base de datos.

Base URL de produccion:

```
https://www.imc-repuestos.dev/api/partner/catalogo
```

La clave se configura solo en Vercel como `PARTNER_CATALOG_API_KEY`. Debe enviarse siempre en el encabezado `X-API-Key`, nunca en la URL.

## Busqueda general

```http
GET /api/partner/catalogo?q=PASTILLA%20FRENO%20CORSA&limit=100
X-API-Key: <PARTNER_CATALOG_API_KEY>
```

`q` admite entre 2 y 120 caracteres. Cuando contiene varias palabras, cada termino debe coincidir en algun campo buscable. La coincidencia es AND por terminos, no una frase exacta: cada palabra puede coincidir en descripcion, palabra clave, marca, codigo interno, codigo de barras, codigo de proveedor, numero de pieza, OEM, equivalente o sustituto.

Los resultados se ordenan por codigo interno exacto, disponibilidad de stock, mayor stock y codigo. El limite es opcional, de 1 a 100, y se aplica por separado a `items` y `kits`.

## Consulta por lote

Para recotizar, pegar OEM masivos, recepcion o ventas ML se pueden consultar hasta 100 codigos exactos en una sola llamada. Los codigos se buscan en codigo interno, codigo de barras, codigo de proveedor, numero de pieza, OEM, equivalentes y sustitutos.
Un codigo de referencia compartido puede devolver mas de un item o kit alternativo.

```http
GET /api/partner/catalogo?codes=CUK2939,POS1130&limit=100
X-API-Key: <PARTNER_CATALOG_API_KEY>
```

Tambien se admite `POST`:

```http
POST /api/partner/catalogo
Content-Type: application/json
X-API-Key: <PARTNER_CATALOG_API_KEY>

{
  "codes": ["CUK2939", "POS1130"],
  "limit": 100
}
```

No se combinan `q` y `codes` en la misma solicitud. Si no se informa `limit`, una consulta por lote usa como limite la cantidad de codigos solicitados, con un minimo de 20 y un maximo de 100.

## Respuesta

Ejemplo validado contra el catalogo actual. Los precios se expresan en ARS y el stock es total. `ubicacion` es la ubicacion fisica principal del item; puede ser `null` si todavia no esta asignada.

```json
{
  "modo": "BUSQUEDA",
  "consulta": "CUK2939",
  "codigosConsultados": [],
  "limitePorTipo": 1,
  "items": [
    {
      "tipo": "ITEM",
      "id": 120439,
      "codigo": "CUK2939MANN",
      "descripcion": "FILTRO HABITACULO AUDI VW A3 VENTO GOLF TIGUAN",
      "palabraClave": "1K1819653B 1K1819653 JZW819653B",
      "codigoBarras": "4011558405205",
      "marca": "MANN FILTER",
      "categoria": "FILTROS",
      "subcategoria": "FILTRO HABITACULO",
      "ubicacion": "D6-2-2 D9-11-1",
      "stockTotal": 17,
      "precioMostrador": 25595.67,
      "proveedores": [
        { "nombre": "D.E.R. S.A.", "codigo": "CUK2939MAN" }
      ],
      "numeroPieza": 1015,
      "oem": ["1K0819644", "1K1819653", "1K1819653B"],
      "equivalentes": ["CUK2939", "LA181", "LAK181"],
      "sustitutos": ["CU2939", "FP2939"],
      "pieza": {
        "numero": 1015,
        "descripcion": "FILTRO HABITACULO AUDI VW A3 VENTO GOLF TIGUAN",
        "oem": ["1K0819644", "1K1819653", "1K1819653B"],
        "equivalentes": ["CUK2939", "LA181", "LAK181"],
        "sustitutos": ["CU2939", "FP2939"]
      }
    }
  ],
  "kits": [
    {
      "tipo": "KIT",
      "id": 846,
      "codigo": "FILTROS280",
      "descripcion": "HU6013ZMANN X1 CUK2939MANN X1",
      "marca": null,
      "categoria": "KIT",
      "subcategoria": null,
      "ubicacion": null,
      "stockTotal": 17,
      "precioMostrador": 42944.44,
      "componentes": [
        {
          "codigo": "CUK2939MANN",
          "descripcion": "FILTRO HABITACULO AUDI VW A3 VENTO GOLF TIGUAN",
          "cantidad": 1,
          "numeroPieza": 1015
        },
        {
          "codigo": "HU6013ZMANN",
          "descripcion": "FILTRO DE ACEITE MANN PARA AUDI A4 Q5 VW VENTO",
          "cantidad": 1,
          "numeroPieza": null
        }
      ]
    }
  ]
}
```

La API no expone costos, precios de proveedor, fotos ni compatibilidades de vehiculos. La ubicacion se informa como referencia operativa, sin desglose de stock por ubicacion.
