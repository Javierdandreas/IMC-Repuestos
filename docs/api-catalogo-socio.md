# API de catalogo para socio

Endpoint de solo lectura para consultar el catalogo enriquecido, sin acceso directo a la base de datos.

```
GET https://imc-cerebro.vercel.app/api/partner/catalogo?q=CUK2939&limit=20
X-API-Key: <PARTNER_CATALOG_API_KEY>
```

`q` es obligatorio y busca por codigo interno, descripcion, palabra clave, codigo de barras, codigo de proveedor, numero de pieza, OEM, equivalentes y sustitutos. `limit` es opcional, tiene minimo 1 y maximo 50, y se aplica por separado a items y kits.

La respuesta contiene:

- `items`: codigo interno, descripcion, palabra clave, codigo de barras, marca, categoria, subcategoria, stock total, precio de mostrador, proveedores con sus codigos y numero de pieza con OEM, equivalentes y sustitutos.
- `kits`: codigo, descripcion, marca, categoria, subcategoria, stock total, precio de mostrador y componentes.

No expone costos, precios de proveedor, ubicaciones, fotos ni compatibilidades de vehiculos.

La clave se configura solo en Vercel como `PARTNER_CATALOG_API_KEY`. Debe enviarse en el encabezado `X-API-Key`, nunca como parametro de URL.
