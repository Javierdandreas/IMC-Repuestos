# API de clientes para socios

Endpoint para consultar clientes activos de IMC antes de crear una orden de venta en GESU. La orden se identifica en GESU por `tipoDocumento` y `numeroDocumento`; esta API no expone `gesu_id`, listas de precios ni bonificaciones.

## Autenticacion

Se usa la misma clave del catalogo: `PARTNER_CATALOG_API_KEY`. Debe enviarse como encabezado `X-API-Key`.

## Consulta por documento

Se recomienda `POST`, para no enviar el DNI/CUIT en la URL:

```http
POST /api/partner/clientes
Content-Type: application/json
X-API-Key: <PARTNER_CATALOG_API_KEY>

{
  "tipoDocumento": "CUIT",
  "numeroDocumento": "30711111119"
}
```

Tambien admite `GET /api/partner/clientes?tipoDocumento=CUIT&numeroDocumento=30711111119`.

## Busqueda general

Busca por razon social, documento, telefono, celular, email o contacto adicional. El texto debe tener al menos dos caracteres.

```http
GET /api/partner/clientes?q=ferreteria&limit=25&page=1
X-API-Key: <PARTNER_CATALOG_API_KEY>
```

El limite maximo es 100 y solo devuelve clientes activos.

## Respuesta

```json
{
  "modo": "DOCUMENTO",
  "consulta": null,
  "page": 1,
  "limit": 25,
  "total": 1,
  "clientes": [
    {
      "id": 123,
      "razonSocial": "CLIENTE EJEMPLO S.R.L.",
      "tipoPersona": "JURIDICA",
      "tipoDocumento": "CUIT",
      "numeroDocumento": "30711111119",
      "validoParaOrdenGesu": true,
      "domicilio": "Av. Siempre Viva 123",
      "localidad": "Villa Martelli",
      "provincia": "Buenos Aires",
      "codigoPostal": "1603",
      "telefono": "1122334455",
      "celular": "1199887766",
      "email": "cliente@ejemplo.com",
      "contactoNombre": "Juan Perez",
      "contactoTelefono": "1122334455",
      "contactoCelular": null,
      "contactoEmail": null,
      "activo": true
    }
  ]
}
```

`validoParaOrdenGesu` es `true` solamente si el cliente tiene DNI o CUIT y un numero de 6 a 11 digitos. Antes de enviar una orden, el integrador debe exigir ese valor en `true`.
